// =============================================================================
// Template: dev-agent.mjs — Background dev server management
//
// Starts the dev server in the background, polls until ready, and returns.
// Use --stop to kill the dev server processes.
//
// Two-tier shutdown design:
//   --stop (this script): kills dev servers only, leaves infrastructure running.
//   --free (setup-worktree): full cleanup — stops Docker, removes volumes, frees slot.
//
// ADAPT: If your project uses Docker for databases or other services, add a
// `docker compose up -d` call at the start of the start() function. This is
// idempotent and ensures infrastructure is running before the dev server starts.
//
// Search for "ADAPT" to find all project-specific sections.
// =============================================================================

import { createConnection } from "node:net";
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

// ADAPT: Paths for PID and log files (should be in a per-worktree directory).
const PID_FILE = ".local-data/dev-agent.pid";
const LOG_FILE = ".local-data/dev-agent.log";

// ADAPT: The string your dev server prints to stdout/stderr when it's ready.
const SUCCESS_MARKER = "Server is ready on port";

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 120_000;

const { values: args } = parseArgs({
  options: {
    stop: { type: "boolean" },
  },
  strict: true,
});

// ADAPT: Read the server port from your project's config file.
// This example reads from a .env file. Adjust the path and variable name,
// or replace with JSON parsing if your project uses config.json instead.
function readServerPort() {
  const envPath = ".env";
  if (!existsSync(envPath)) {
    console.error(`Error: ${envPath} not found. Run setup-worktree first.`);
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf-8");
  const match = content.match(/^PORT=(\d+)/m);
  if (!match) {
    console.error(`Error: PORT not found in ${envPath}.`);
    process.exit(1);
  }
  return Number(match[1]);
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

function readPid() {
  if (!existsSync(PID_FILE)) return;
  const raw = readFileSync(PID_FILE, "utf-8").trim();
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

function cleanupPidFile() {
  if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
}

async function stop() {
  const pid = readPid();
  if (pid === undefined || !isProcessAlive(pid)) {
    cleanupPidFile();
    console.log("No dev-agent process is running.");
    return;
  }

  console.log(`Stopping dev-agent (PID ${pid})...`);
  killProcessGroup(pid, "SIGTERM");

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    if (!isProcessGroupAlive(pid)) {
      cleanupPidFile();
      console.log("Stopped.");
      return;
    }
  }

  killProcessGroup(pid, "SIGKILL");
  cleanupPidFile();
  console.log("Force-killed.");
}

async function waitForReady(pid) {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      const log = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, "utf-8") : "";
      console.error("Error: Dev server process exited unexpectedly.");
      if (log) console.error(`\nLog output:\n${log}`);
      cleanupPidFile();
      process.exit(1);
    }

    if (existsSync(LOG_FILE)) {
      const log = readFileSync(LOG_FILE, "utf-8");
      if (log.includes(SUCCESS_MARKER)) return;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.error(`Error: Dev server did not become ready within ${TIMEOUT_MS / 1000}s.`);
  console.error(`Check the log file: ${join(process.cwd(), LOG_FILE)}`);
  process.exit(1);
}

async function start() {
  const serverPort = readServerPort();

  if (await isPortBusy(serverPort)) {
    console.error(
      `Error: Port ${serverPort} is already in use. A dev server may already be running.`,
    );
    process.exit(1);
  }

  const existingPid = readPid();
  if (existingPid !== undefined && isProcessAlive(existingPid)) {
    console.error(`Error: dev-agent is already running (PID ${existingPid}).`);
    process.exit(1);
  }
  cleanupPidFile();

  const logFd = openSync(LOG_FILE, "w");

  // ADAPT: Replace "npm run dev" with whatever starts your dev server.
  const child = spawn("npm", ["run", "dev"], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });

  writeFileSync(PID_FILE, String(child.pid));
  child.unref();
  closeSync(logFd);

  await waitForReady(child.pid);

  const logPath = join(process.cwd(), LOG_FILE);
  console.log(`Dev server started (PID ${child.pid}).`);
  console.log(`Log file: ${logPath}`);
}

if (args.stop) {
  await stop();
} else {
  await start();
}
