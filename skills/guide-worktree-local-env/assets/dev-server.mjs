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
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const LOG_TAIL_LINES = 30;
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 120_000;

// Shared worktree state files. Resolved against cwd; in linked worktrees the
// `.local` symlink points at the main worktree's directory.
const WORKTREES_DIR_REL = ".local/worktrees";
const SLOTS_FILE_REL = ".local/worktrees/slots.json";
const DEV_SERVERS_FILE_REL = ".local/worktrees/dev-servers.json";

// ADAPT: Default cap on concurrent dev-servers. `0` = unlimited.
const DEV_LIMIT_DEFAULT = 5;
// ADAPT: Project-specific override env var name; e.g. `MYAPP_DEV_LIMIT`.
const PROJECT_DEV_LIMIT_VAR = "<PROJECT>_DEV_LIMIT";

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
      list: { type: "boolean" },
      all: { type: "boolean" },
    },
    strict: true,
  });

  validateArgs(args);

  if (args.list) {
    await listDevServers();
  } else if (args.stop && args.all) {
    await stopAll();
  } else if (args.stop) {
    await stop();
  } else {
    await start();
  }
}

function validateArgs(args) {
  if (args.all && !args.stop) {
    console.error("Error: --all requires --stop.");
    process.exit(1);
  }
  if (args.list && (args.stop || args.all)) {
    console.error("Error: --list is mutually exclusive with --stop and --all.");
    process.exit(1);
  }
}

async function start() {
  const limit = readDevLimit();
  const active = pruneDeadServers(readDevServers()).servers;
  if (limit > 0 && active.length >= limit) {
    console.error(
      `Error: dev-server cap reached (${active.length}/${limit}). Active dev-servers:`,
    );
    printActiveServers(active);
    console.error(
      "Run `dev:down` in another worktree, or `dev:down --all`.",
    );
    process.exit(1);
  }

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

  registerDevServer(pids);

  printSummary(serverPorts, pids);
}

async function stop() {
  for (const server of SERVERS) {
    await stopOne(server);
  }
  unregisterDevServer();
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
  const slot = resolveCurrentSlot();
  console.log("\nDev servers started!");
  console.log(`  Worktree: slot ${slot.slot}, owner ${slot.owner}`);
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
  await stopProcessGroup(pid);
  cleanupPidFile(server.pidFile);
  console.log(`${server.name} stopped.`);
}

async function stopProcessGroup(pid) {
  killProcessGroup(pid, "SIGTERM");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    if (!isProcessGroupAlive(pid)) return;
  }
  killProcessGroup(pid, "SIGKILL");
}

// --- Registry I/O ---

function readDevServers() {
  if (!existsSync(DEV_SERVERS_FILE_REL)) return { servers: [] };
  return JSON.parse(readFileSync(DEV_SERVERS_FILE_REL, "utf-8"));
}

function writeDevServers(data) {
  mkdirSync(WORKTREES_DIR_REL, { recursive: true });
  writeFileSync(DEV_SERVERS_FILE_REL, `${JSON.stringify(data, undefined, 2)}\n`);
}

function readSlots() {
  if (!existsSync(SLOTS_FILE_REL)) return { slots: {} };
  return JSON.parse(readFileSync(SLOTS_FILE_REL, "utf-8"));
}

function pruneDeadServers(data) {
  const live = data.servers.filter((entry) =>
    Object.values(entry.pids).some((pid) => isProcessAlive(pid)),
  );
  if (live.length !== data.servers.length) {
    writeDevServers({ servers: live });
  }
  return { servers: live };
}

function readDevLimit() {
  const candidates = [process.env[PROJECT_DEV_LIMIT_VAR], process.env.PROJECT_DEV_LIMIT];
  for (const raw of candidates) {
    if (raw === undefined || raw === "") continue;
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return DEV_LIMIT_DEFAULT;
}

function lookupSlotForCwd() {
  const registry = readSlots();
  const resolvedCwd = resolve(process.cwd());
  for (const [port, entry] of Object.entries(registry.slots)) {
    if (resolve(entry.worktree) === resolvedCwd) {
      return {
        slot: Number(port),
        worktree: entry.worktree,
        branch: entry.branch,
        owner: entry.owner ?? "default",
      };
    }
  }
  return undefined;
}

function synthesizeMainSlot() {
  const gitCommonDir = execSync("git rev-parse --path-format=absolute --git-common-dir", {
    encoding: "utf-8",
  }).trim();
  const mainWorktree = dirname(gitCommonDir);
  const cwd = resolve(process.cwd());
  if (resolve(mainWorktree) !== cwd) return undefined;
  const branch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  // ADAPT: the slot for the main worktree is the primary port read from the env file.
  const slot = Number(readEnvVar(SERVERS[0].portConfig.file, SERVERS[0].portConfig.varName));
  return { slot, worktree: cwd, branch, owner: "default" };
}

function resolveCurrentSlot() {
  const slot = lookupSlotForCwd() ?? synthesizeMainSlot();
  if (!slot) {
    console.error("Error: No slot found for this worktree. Run setup-worktree first.");
    process.exit(1);
  }
  return slot;
}

function registerDevServer(pids) {
  const slot = resolveCurrentSlot();
  const pidMap = {};
  SERVERS.forEach((server, i) => {
    pidMap[server.name] = pids[i];
  });
  const data = pruneDeadServers(readDevServers());
  data.servers.push({
    slot: slot.slot,
    worktree: slot.worktree,
    branch: slot.branch,
    owner: slot.owner,
    pids: pidMap,
    startedAt: new Date().toISOString(),
  });
  writeDevServers(data);
}

function unregisterDevServer() {
  if (!existsSync(DEV_SERVERS_FILE_REL)) return;
  const data = pruneDeadServers(readDevServers());
  const resolvedCwd = resolve(process.cwd());
  const filtered = data.servers.filter((entry) => resolve(entry.worktree) !== resolvedCwd);
  if (filtered.length === data.servers.length) return;
  writeDevServers({ servers: filtered });
}

async function listDevServers() {
  const data = pruneDeadServers(readDevServers());
  if (data.servers.length === 0) {
    console.log("No dev-servers running.");
    return;
  }
  const sorted = [...data.servers].sort((a, b) => a.slot - b.slot);
  for (const entry of sorted) {
    const pids = Object.entries(entry.pids)
      .map(([name, pid]) => `${name}=${pid}`)
      .join(",");
    console.log(
      `  slot ${entry.slot}  branch=${entry.branch}  owner=${entry.owner}  pids=${pids}  startedAt=${entry.startedAt}  worktree=${entry.worktree}`,
    );
  }
}

async function stopAll() {
  const data = pruneDeadServers(readDevServers());
  if (data.servers.length === 0) {
    console.log("No dev-servers running.");
    return;
  }
  for (const entry of data.servers) {
    console.log(`Stopping slot ${entry.slot} (${entry.branch}, owner=${entry.owner})...`);
    for (const [name, pid] of Object.entries(entry.pids)) {
      if (!isProcessAlive(pid)) continue;
      console.log(`  ${name} (PID ${pid})`);
      await stopProcessGroup(pid);
    }
    for (const server of SERVERS) {
      const pidFile = join(entry.worktree, server.pidFile);
      if (existsSync(pidFile)) unlinkSync(pidFile);
    }
  }
  writeDevServers({ servers: [] });
  console.log(`Stopped ${data.servers.length} dev-server(s).`);
}

function printActiveServers(active) {
  const sorted = [...active].sort((a, b) => a.slot - b.slot);
  for (const entry of sorted) {
    const pids = Object.entries(entry.pids)
      .map(([name, pid]) => `${name}=${pid}`)
      .join(",");
    process.stderr.write(
      `  slot ${entry.slot}  branch=${entry.branch}  owner=${entry.owner}  pids=${pids}  startedAt=${entry.startedAt}  worktree=${entry.worktree}\n`,
    );
  }
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
