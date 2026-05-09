// =============================================================================
// Template: dev-server.mjs — Background dev server management
//
// Starts the dev server (one or more cooperating processes) in the background,
// polls until ready, and returns. Use --stop to kill the dev server processes.
//
// Two-tier shutdown design:
//   --stop (this script): kills the dev server only, leaves infrastructure running.
//   --remove (setup-worktree): full cleanup — stops the dev server, Docker, removes volumes, frees slot, removes worktree.
//
// Infrastructure (Docker, etc.) is started in `ensureInfrastructure()`, which
// is a no-op by default. See its body for the Docker pattern.
//
// Search for "ADAPT" to find all project-specific sections.
// =============================================================================

import { execSync, spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const LOG_TAIL_LINES = 30;
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 120_000;

// ADAPT: Add one entry per dev server process. A "dev server" can be a single
// process or several cooperating processes (e.g. an API watcher plus a frontend
// bundler) — add one entry per process either way.
//
// `errorMarkers` lets you fail fast on known fatal log patterns so the script
// aborts immediately instead of waiting for the timeout. Examples:
//   - `"[ExceptionHandler]"` — Nest's canonical fatal-init marker.
//   - `"Node.js v"` — the footer Node prints right before exit on uncaught
//     errors (catches crashes before any framework's exception handler runs).
//
// `portConfig` tells the script how to read the port for the busy-port check.
// It's a `(file, varName)` pair pointing to a `KEY=VALUE` line.
const SERVERS = [
  {
    name: "dev",                                  // ADAPT
    command: "npm",                               // ADAPT
    args: ["run", "dev"],                         // ADAPT
    pidFile: ".local-data/dev-server.pid",         // ADAPT
    logFile: ".local-data/logs/dev-server.log",    // ADAPT
    successMarker: "Server is ready on port",     // ADAPT
    errorMarkers: [],                             // ADAPT
    portConfig: {                                 // ADAPT
      file: ".env",
      varName: "PORT",
    },
  },
];

await main();

async function main() {
  const { values: args } = parseArgs({
    options: {
      stop: { type: "boolean" },
    },
    strict: true,
  });

  if (args.stop) {
    await stop();
  } else {
    await start();
  }
}

async function start() {
  const serverPorts = resolveServerPorts();

  await ensurePortsFree(serverPorts);
  ensureNoExistingProcesses();
  await ensureInfrastructure();

  const pids = [];
  for (const server of SERVERS) {
    console.log(`Starting ${server.name} dev server...`);
    pids.push(spawnServer(server));
  }

  await awaitAllReady(pids);

  printSummary(serverPorts, pids);
}

async function stop() {
  for (const server of SERVERS) {
    await stopOne(server);
  }
}

function resolveServerPorts() {
  return SERVERS.map((server) => {
    const port = Number(readEnvVar(server.portConfig.file, server.portConfig.varName));
    return [server, port];
  });
}

async function ensurePortsFree(serverPorts) {
  const busyResults = await Promise.all(serverPorts.map(([, port]) => isPortBusy(port)));
  let anyBusy = false;
  busyResults.forEach((busy, i) => {
    if (busy) {
      const [server, port] = serverPorts[i];
      console.error(`Error: Port ${port} (${server.name}) is already in use.`);
      anyBusy = true;
    }
  });
  if (anyBusy) process.exit(1);
}

function ensureNoExistingProcesses() {
  for (const server of SERVERS) {
    const existingPid = readPid(server.pidFile);
    if (existingPid !== undefined && isProcessAlive(existingPid)) {
      console.error(`Error: ${server.name} is already running (PID ${existingPid}).`);
      process.exit(1);
    }
    cleanupPidFile(server.pidFile);
  }
}

// ADAPT: If your project uses Docker for databases or other services,
// uncomment / extend this. `docker compose up -d` is idempotent — it no-ops
// if containers are already running.
async function ensureInfrastructure() {
  // console.log("Ensuring infrastructure is running...");
  // try {
  //   execSync("docker compose up -d", { stdio: "pipe" });
  // } catch {
  //   console.error("Warning: docker compose up -d failed.");
  // }
}

function spawnServer(server) {
  mkdirSync(dirname(server.logFile), { recursive: true });
  const logFd = openSync(server.logFile, "w");

  const child = spawn(server.command, server.args, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });

  writeFileSync(server.pidFile, String(child.pid));
  child.unref();
  closeSync(logFd);

  return child.pid;
}

async function awaitAllReady(pids) {
  try {
    await Promise.all(SERVERS.map((server, i) => waitForReady(server, pids[i])));
  } catch (err) {
    if (!(err instanceof StartupError)) throw err;
    await handleStartupFailure(err);
  }
}

async function waitForReady(server, pid) {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      throw new StartupError(server.name, "process exited unexpectedly", server.logFile);
    }

    if (existsSync(server.logFile)) {
      const logContent = readFileSync(server.logFile, "utf-8");
      if (logContent.includes(server.successMarker)) return;
      const errorMarker = server.errorMarkers.find((m) => logContent.includes(m));
      if (errorMarker !== undefined) {
        throw new StartupError(server.name, `error detected (${errorMarker})`, server.logFile);
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new StartupError(
    server.name,
    `did not become ready within ${TIMEOUT_MS / 1000}s`,
    server.logFile,
  );
}

async function handleStartupFailure(err) {
  console.error(`\nError: ${err.label} ${err.reason}.`);
  if (err.logFile && existsSync(err.logFile)) {
    const lines = readFileSync(err.logFile, "utf-8").split("\n").slice(-LOG_TAIL_LINES);
    console.error(`\n--- ${err.label} log tail (last ${LOG_TAIL_LINES} lines) ---`);
    console.error(lines.join("\n"));
    console.error(`--- end ---\nFull log: ${join(process.cwd(), err.logFile)}`);
  }

  console.error("\nStopping dev servers...");
  await stop();
  process.exit(1);
}

function printSummary(serverPorts, pids) {
  console.log("\nDev servers started!");
  SERVERS.forEach((server, i) => {
    const [, port] = serverPorts[i];
    const url = `http://localhost:${port}/`;
    const logPath = join(process.cwd(), server.logFile);
    console.log(`  ${server.name}: ${url}  (PID ${pids[i]})`);
    console.log(`    log: ${logPath}`);
  });
  console.log("");
}

async function stopOne(server) {
  const pid = readPid(server.pidFile);
  if (pid === undefined || !isProcessAlive(pid)) {
    cleanupPidFile(server.pidFile);
    console.log(`No ${server.name} process is running.`);
    return;
  }

  console.log(`Stopping ${server.name} (PID ${pid})...`);
  killProcessGroup(pid, "SIGTERM");

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    if (!isProcessGroupAlive(pid)) {
      cleanupPidFile(server.pidFile);
      console.log(`${server.name} stopped.`);
      return;
    }
  }

  killProcessGroup(pid, "SIGKILL");
  cleanupPidFile(server.pidFile);
  console.log(`${server.name} force-killed.`);
}

// --- Leaf utilities ---

/**
 * Reads a `KEY=VALUE` line from a config file. Used for the port busy-check
 * and (optionally) for printing final URLs in the summary.
 */
function readEnvVar(filePath, varName) {
  if (!existsSync(filePath)) {
    console.error(`Error: ${filePath} not found. Run setup-worktree first.`);
    process.exit(1);
  }
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(new RegExp(`^${varName}=(.+)`, "m"));
  if (!match) {
    console.error(`Error: ${varName} not found in ${filePath}.`);
    process.exit(1);
  }
  return match[1].trim();
}

function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

function readPid(pidFile) {
  if (!existsSync(pidFile)) return;
  const raw = readFileSync(pidFile, "utf-8").trim();
  const pid = Number(raw);
  if (!Number.isInteger(pid) || pid <= 0) return;
  return pid;
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isProcessGroupAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    // group already gone, try the leader directly
    try {
      process.kill(pid, signal);
    } catch {
      // already dead
    }
  }
}

function cleanupPidFile(pidFile) {
  if (existsSync(pidFile)) unlinkSync(pidFile);
}

class StartupError extends Error {
  constructor(label, reason, logFile) {
    super(`${label}: ${reason}`);
    this.label = label;
    this.reason = reason;
    this.logFile = logFile;
  }
}
