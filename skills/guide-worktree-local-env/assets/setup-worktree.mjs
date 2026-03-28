// =============================================================================
// Template: setup-worktree.mjs
//
// This template uses a port step of 10, giving each worktree room for multiple
// ports (e.g., slot 8010 → frontend 8010, server 8011). For single-port
// projects, simplify: remove PORT_STEP, the modulo check in isValidPort(),
// and the secondary port derivation.
//
// Search for "ADAPT" to find all project-specific sections.
// =============================================================================

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

// ADAPT: Port scheme — adjust base port, step, and range for your project.
// With a step of 10 you get room for multiple ports per slot.
const BASE_PORT = 8100;
const PORT_STEP = 10;
const MIN_PORT = BASE_PORT + PORT_STEP;
const MAX_PORT = BASE_PORT + 9 * PORT_STEP;

// ADAPT: Path to the slot registry file (stored in a shared/symlinked directory).
const SLOTS_FILE = ".local/worktree-slots.json";

function isValidPort(port) {
  return (
    Number.isInteger(port) &&
    port >= MIN_PORT &&
    port <= MAX_PORT &&
    (port - BASE_PORT) % PORT_STEP === 0
  );
}

function allPorts() {
  const ports = [];
  for (let p = MIN_PORT; p <= MAX_PORT; p += PORT_STEP) {
    ports.push(p);
  }
  return ports;
}

// --- CLI parsing ---

const { values: args } = parseArgs({
  options: {
    slot: { type: "string", short: "s" },
    free: { type: "boolean" },
    force: { type: "boolean" },
    quiet: { type: "boolean", short: "q" },
  },
  strict: true,
});

const quiet = args.quiet ?? false;
function log(msg) {
  if (!quiet) console.log(msg);
}

// --- Worktree detection ---

const currentWorktree = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();

const gitCommonDir = execSync("git rev-parse --path-format=absolute --git-common-dir", {
  encoding: "utf-8",
}).trim();
const mainWorktree = dirname(gitCommonDir);
const isMainWorktree = resolve(currentWorktree) === resolve(mainWorktree);

if (isMainWorktree && !args.free) {
  console.error("Error: This script must be run from a worktree, not from the main repository.");
  process.exit(1);
}

const currentBranch = isMainWorktree
  ? ""
  : execSync("git branch --show-current", { encoding: "utf-8" }).trim();

// --- Slot registry helpers ---

function readSlots() {
  const filePath = join(mainWorktree, SLOTS_FILE);
  if (!existsSync(filePath)) return { slots: {} };
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeSlots(registry) {
  const filePath = join(mainWorktree, SLOTS_FILE);
  mkdirSync(join(mainWorktree, ".local"), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(registry, undefined, 2)}\n`);
}

// --- Handle --free ---

if (args.free) {
  const registry = readSlots();

  let freedPort;
  if (args.slot !== undefined) {
    freedPort = args.slot;
    if (!registry.slots[freedPort]) {
      console.error(`Error: Port ${freedPort} is not assigned.`);
      process.exit(1);
    }
  } else {
    const resolvedCurrent = resolve(currentWorktree);
    const entry = Object.entries(registry.slots).find(
      ([, v]) => resolve(v.worktree) === resolvedCurrent,
    );
    if (!entry) {
      console.error("Error: No slot found for this worktree. Use --slot PORT to specify one.");
      process.exit(1);
    }
    [freedPort] = entry;
  }

  

  delete registry.slots[freedPort];
  writeSlots(registry);
  console.log(`Freed slot ${freedPort}.`);
  process.exit(0);
}

// --- Resolve slot ---

const registry = readSlots();
const resolvedCurrent = resolve(currentWorktree);
let frontendPort;

if (args.slot !== undefined) {
  frontendPort = Number(args.slot);
  if (!isValidPort(frontendPort)) {
    console.error(`Error: Slot must be a valid port: ${allPorts().join(", ")}.`);
    process.exit(1);
  }
  const existing = registry.slots[String(frontendPort)];
  if (existing && resolve(existing.worktree) !== resolvedCurrent) {
    console.error(
      `Error: Slot ${frontendPort} is already taken by ${existing.worktree} (branch: ${existing.branch}).`,
    );
    process.exit(1);
  }
} else {
  const existingEntry = Object.entries(registry.slots).find(
    ([, v]) => resolve(v.worktree) === resolvedCurrent,
  );
  if (existingEntry) {
    frontendPort = Number(existingEntry[0]);
  } else {
    for (const port of allPorts()) {
      if (!registry.slots[String(port)]) {
        frontendPort = port;
        break;
      }
    }
    if (frontendPort === undefined) {
      console.error("Error: All slots are taken. Free a slot with --free first.");
      process.exit(1);
    }
  }
}

registry.slots[String(frontendPort)] = { worktree: currentWorktree, branch: currentBranch };
writeSlots(registry);

// ADAPT: Derive additional ports from the frontend port.
const serverPort = frontendPort + 1;

log(`Using slot ${frontendPort} (frontend: ${frontendPort}, server: ${serverPort})`);

// --- Create per-worktree directories ---

// ADAPT: List the per-worktree directories your project needs.
const localDataDirs = [
  ".local-data/cache",
  ".local-data/backup",
  ".local-data/generated-sites",
  ".local-data/generator-debug",
];
for (const dir of localDataDirs) {
  mkdirSync(join(currentWorktree, dir), { recursive: true });
}

// --- Symlink shared directories from main worktree ---

// ADAPT: List the gitignored directories that should be shared across worktrees.
for (const dirName of [".local", ".plans"]) {
  const link = join(currentWorktree, dirName);
  if (!existsSync(link)) {
    const mainDir = join(mainWorktree, dirName);
    mkdirSync(mainDir, { recursive: true });
    const relTarget = relative(currentWorktree, mainDir);
    symlinkSync(relTarget, link);
    log(`Created ${dirName} symlink → main worktree.`);
  } else {
    log(`Skipped ${dirName} symlink (already exists).`);
  }
}

// --- Provision database (file copy) ---

// ADAPT: This section copies SQLite database files from the main worktree.
// For Docker-managed databases, replace this with container creation,
// migrations, and seeding.
const localDataDir = join(currentWorktree, ".local-data/data");
const mainDataDir = join(mainWorktree, ".local-data/data");
mkdirSync(localDataDir, { recursive: true });
const dataEntries = readdirSync(localDataDir);

if (dataEntries.length === 0 || args.force) {
  if (existsSync(mainDataDir)) {
    log("Copying databases from main worktree...");
    cpSync(mainDataDir, localDataDir, { recursive: true, force: true });
  } else {
    log("No .local-data/data/ in main worktree, skipping database copy.");
  }
} else {
  log("Skipping database copy (.local-data/data/ is not empty; use --force to overwrite).");
}

// --- Generate config files ---

function writeConfigFile(relPath, content, label) {
  const fullPath = join(currentWorktree, relPath);
  const alreadyExists = existsSync(fullPath);
  if (alreadyExists && !args.force) {
    log(`Skipped ${label} (already exists; use --force to overwrite).`);
    return;
  }
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
  log(`${alreadyExists ? "Overwritten" : "Created"} ${label}.`);
}

// ADAPT: Generate each config file your project needs. Read from the checked-in
// example file, patch the port(s), and write the gitignored actual file.
// Add or remove blocks below depending on which config files your project uses.

// .env file — read from .env.example, patch port variables, write .env
const envExample = readFileSync(join(currentWorktree, ".env.example"), "utf-8");
const envLines = envExample.trimEnd().split("\n");
const envVars = { PORT: String(frontendPort), SERVER_PORT: String(serverPort) };
for (const [key, value] of Object.entries(envVars)) {
  const idx = envLines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx !== -1) {
    envLines[idx] = `${key}=${value}`;
  } else {
    envLines.push(`${key}=${value}`);
  }
}
writeConfigFile(".env", `${envLines.join("\n")}\n`, ".env");

// .vscode/settings.json (optional, copied from example without patching)
const vscodeSrc = join(currentWorktree, ".vscode/settings.example.json");
if (existsSync(vscodeSrc)) {
  writeConfigFile(
    ".vscode/settings.json",
    readFileSync(vscodeSrc, "utf-8"),
    ".vscode/settings.json",
  );
} else {
  log("Skipped .vscode/settings.json (no settings.example.json found).");
}

// --- Install dependencies & build ---

// ADAPT: Replace with your project's install and build commands.
const npmStdio = quiet ? "pipe" : "inherit";

log("\nRunning npm install...");
try {
  execSync("npm install", { stdio: npmStdio, cwd: currentWorktree });
} catch (err) {
  if (quiet) process.stderr.write(err.stderr ?? err.stdout ?? "");
  console.error("Error: npm install failed.");
  process.exit(1);
}

log("\nRunning npm run build...");
try {
  execSync("npm run build", { stdio: npmStdio, cwd: currentWorktree });
} catch (err) {
  if (quiet) process.stderr.write(err.stderr ?? err.stdout ?? "");
  console.error("Error: npm run build failed.");
  process.exit(1);
}

// --- Summary ---

// ADAPT: Print URLs relevant to your project.
console.log(`
Worktree setup complete!
  Slot:      ${frontendPort}
  Frontend:  http://localhost:${frontendPort}/
  Server:    http://localhost:${serverPort}/
`);
