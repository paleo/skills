// =============================================================================
// Template: setup-worktree.mjs
//
// Worktree lifecycle management: creation, setup, and removal.
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
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

// ADAPT: Port scheme — adjust base port, step, and range for your project.
// With a step of 10 you get room for multiple ports per slot.
const BASE_PORT = 8100;
const PORT_STEP = 10;
const MIN_PORT = BASE_PORT + PORT_STEP;
const MAX_PORT = BASE_PORT + 9 * PORT_STEP;

// ADAPT: Path to the slot registry file (stored in a shared/symlinked directory).
const SLOTS_FILE = ".local/worktree-slots.json";

// ADAPT: Path to the dev-agent PID file (must match dev-agent.mjs).
const DEV_AGENT_PID_FILE = ".local-data/dev-agent.pid";

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

function computeWorktreePath(mainWorktree, branch) {
  const repoName = basename(mainWorktree);
  const sanitized = branch.replaceAll("/", "-");
  return join(dirname(mainWorktree), `${repoName}-${sanitized}`);
}

// --- CLI parsing ---

const options = {
  help: { type: "boolean", short: "h", description: "Show this help message" },
  checkout: {
    type: "string",
    arg: "branch",
    description: "Create a worktree for an existing branch, then set up the local environment",
  },
  create: {
    type: "string",
    arg: "branch",
    description:
      "Create a new branch + worktree, then set up the local environment. If the branch already exists, appends a numeric suffix (-2, -3, ...)",
  },
  self: {
    type: "boolean",
    description: "Set up the local environment in the current linked worktree",
  },
  remove: {
    type: "string",
    arg: "branch",
    description: "Remove a worktree by branch name (stop dev server, free slot, delete directory)",
  },
  "remove-self": {
    type: "boolean",
    description:
      "Remove the current linked worktree (same as --remove, but for the worktree you are in)",
  },
  "no-remote-check": {
    type: "boolean",
    description:
      "Skip remote branch verification when removing (use with --remove or --remove-self)",
  },
  slot: {
    type: "string",
    short: "s",
    arg: "port",
    description: "Use a specific slot instead of auto-assigning",
  },
  force: {
    type: "boolean",
    description: "Overwrite existing config files and re-provision the database",
  },
  verbose: { type: "boolean", short: "v", description: "Show intermediate output" },
};

const { values: args } = parseArgs({ options, strict: true });

function printHelp() {
  console.log("Usage: setup-worktree [options]\n");
  console.log("Manage worktree lifecycle: creation, local environment setup, and removal.\n");
  for (const [name, opt] of Object.entries(options)) {
    const shortFlag = opt.short ? `-${opt.short}, ` : "";
    const argSuffix = opt.arg ? ` <${opt.arg}>` : "";
    const flag = `${shortFlag}--${name}${argSuffix}`;
    console.log(`  ${flag.padEnd(28)} ${opt.description}`);
  }
}

if (args.help) {
  printHelp();
  process.exit(0);
}

const verbose = args.verbose ?? false;
function log(msg) {
  if (verbose) console.log(msg);
}

// --- Flag validation ---

const isRemove = args.remove !== undefined || args["remove-self"];
const isSetup = args.checkout !== undefined || args.create !== undefined || args.self;
const modeFlags = [args.checkout, args.create, args.self, isRemove].filter(Boolean);
if (modeFlags.length > 1) {
  console.error(
    "Error: --checkout, --create, --self, --remove, and --remove-self are mutually exclusive.",
  );
  process.exit(1);
}

if (args.remove !== undefined && args["remove-self"]) {
  console.error("Error: --remove and --remove-self are mutually exclusive.");
  process.exit(1);
}

if ((args.slot !== undefined || args.force) && !isSetup) {
  console.error("Error: --slot and --force can only be used with --checkout, --create, or --self.");
  process.exit(1);
}

if (args["no-remote-check"] && !isRemove) {
  console.error("Error: --no-remote-check is only valid with --remove or --remove-self.");
  process.exit(1);
}

if (!isSetup && !isRemove) {
  printHelp();
  process.exit(0);
}

// --- Worktree detection ---

let currentWorktree = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();

const gitCommonDir = execSync("git rev-parse --path-format=absolute --git-common-dir", {
  encoding: "utf-8",
}).trim();
const mainWorktree = dirname(gitCommonDir);
let isMainWorktree = resolve(currentWorktree) === resolve(mainWorktree);

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

// --- Branch existence helper ---

function branchExists(branch) {
  try {
    execSync(`git rev-parse --verify ${branch}`, { stdio: "pipe" });
    return true;
  } catch {
    try {
      execSync(`git rev-parse --verify origin/${branch}`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
}

// --- Dev server stop helper ---

function stopDevServer(worktreePath) {
  const pidFile = join(worktreePath, DEV_AGENT_PID_FILE);
  if (!existsSync(pidFile)) return;

  const raw = readFileSync(pidFile, "utf-8").trim();
  const pid = Number(raw);
  if (!Number.isInteger(pid) || pid <= 0) return;

  try {
    process.kill(pid, 0); // check if alive
  } catch {
    unlinkSync(pidFile);
    return;
  }

  log(`Stopping dev server (PID ${pid})...`);
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already dead
    }
  }

  const deadline = Date.now() + 5_000;
  let stillAlive = true;
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0);
    } catch {
      stillAlive = false;
      break;
    }
    execSync("sleep 0.3", { stdio: "pipe" });
  }

  if (stillAlive) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // already dead
    }
  }

  if (existsSync(pidFile)) unlinkSync(pidFile);
}

// --- Worktree guard ---

if (args.checkout || args.create) {
  if (!isMainWorktree) {
    console.error("Error: --checkout and --create must be run from the main worktree.");
    process.exit(1);
  }
} else if (args.self) {
  if (isMainWorktree) {
    console.error("Error: --self must be run from a linked worktree, not from the main worktree.");
    process.exit(1);
  }
} else if (isRemove) {
  // --remove can be run from anywhere except the worktree being removed
  // --remove-self must not be run from the main worktree (validated below)
}

// --- Early slot validation (before creating branch/worktree) ---

if ((args.checkout || args.create || args.self) && args.slot !== undefined) {
  const earlyPort = Number(args.slot);
  if (!isValidPort(earlyPort)) {
    console.error(`Error: Slot must be a valid port: ${allPorts().join(", ")}.`);
    process.exit(1);
  }
  const earlyRegistry = readSlots();
  const existing = earlyRegistry.slots[String(earlyPort)];
  if (existing && resolve(existing.worktree) !== resolve(currentWorktree)) {
    console.error(
      `Error: Slot ${earlyPort} is already taken by ${existing.worktree} (branch: ${existing.branch}).`,
    );
    process.exit(1);
  }
}

// --- Handle --checkout ---

if (args.checkout) {
  const branch = args.checkout;
  const stdio = verbose ? "inherit" : "pipe";

  if (!branchExists(branch)) {
    console.error(`Error: Branch "${branch}" does not exist locally or on the remote.`);
    process.exit(1);
  }

  const worktreePath = computeWorktreePath(mainWorktree, branch);
  execSync(`git worktree add ${worktreePath} ${branch}`, { stdio });

  currentWorktree = worktreePath;
  isMainWorktree = false;
}

// --- Handle --create ---

if (args.create) {
  const requestedBranch = args.create;
  const stdio = verbose ? "inherit" : "pipe";

  let finalBranch = requestedBranch;
  if (branchExists(finalBranch)) {
    let suffix = 2;
    while (branchExists(`${requestedBranch}-${suffix}`)) {
      suffix++;
    }
    finalBranch = `${requestedBranch}-${suffix}`;
  }

  const worktreePath = computeWorktreePath(mainWorktree, finalBranch);
  execSync(`git worktree add -b ${finalBranch} ${worktreePath}`, { stdio });

  console.log(`Branch: ${finalBranch}`);

  currentWorktree = worktreePath;
  isMainWorktree = false;
}

// --- Handle --remove / --remove-self ---

if (isRemove) {
  const removeSelf = Boolean(args["remove-self"]);
  const registry = readSlots();
  let branch;
  let slotPort;
  let worktreePath;

  if (removeSelf) {
    if (isMainWorktree) {
      console.error("Error: Cannot remove the main worktree.");
      process.exit(1);
    }
    const resolvedCurrent = resolve(currentWorktree);
    const entry = Object.entries(registry.slots).find(
      ([, v]) => resolve(v.worktree) === resolvedCurrent,
    );
    if (!entry) {
      console.error("Error: No slot found for this worktree in the registry.");
      process.exit(1);
    }
    [slotPort] = entry;
    branch = entry[1].branch;
    worktreePath = currentWorktree;
  } else {
    branch = args.remove;
    const entry = Object.entries(registry.slots).find(([, v]) => v.branch === branch);
    if (!entry) {
      console.error(`Error: No worktree found for branch "${branch}" in the slot registry.`);
      process.exit(1);
    }
    [slotPort] = entry;
    worktreePath = entry[1].worktree;

    if (resolve(currentWorktree) === resolve(worktreePath)) {
      console.error("Error: You are currently in this worktree. Use --remove-self instead.");
      process.exit(1);
    }
  }

  // Remote check
  if (!args["no-remote-check"]) {
    execSync("git fetch", { stdio: verbose ? "inherit" : "pipe" });
    const remoteBranches = execSync(`git branch -r --list "origin/${branch}"`, {
      encoding: "utf-8",
    }).trim();
    if (remoteBranches.length > 0) {
      console.error(
        `Error: Branch "${branch}" still exists on the remote. Use --no-remote-check to skip this verification.`,
      );
      process.exit(1);
    }
  }

  if (!existsSync(worktreePath)) {
    console.warn(`Warning: Worktree directory ${worktreePath} not found. Cleaning up registry only.`);
    delete registry.slots[slotPort];
    writeSlots(registry);
    console.log(`Removed registry entry for branch "${branch}" (slot ${slotPort}).`);
    process.exit(0);
  }

  stopDevServer(worktreePath);

  delete registry.slots[slotPort];
  writeSlots(registry);

  if (removeSelf) {
    process.chdir(mainWorktree);
  }

  execSync(`git worktree remove --force ${worktreePath}`, {
    stdio: verbose ? "inherit" : "pipe",
  });

  console.log(`Removed worktree for branch "${branch}" (slot ${slotPort}).`);
  if (removeSelf) {
    console.log(`Now run: cd ${mainWorktree}`);
  }
  process.exit(0);
}

// --- Get current branch ---

const currentBranch = execSync("git branch --show-current", { encoding: "utf-8", cwd: currentWorktree }).trim();

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
      console.error("Error: All slots are taken. Remove a worktree with --remove first.");
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
const npmStdio = verbose ? "inherit" : "pipe";

log("\nRunning npm install...");
try {
  execSync("npm install", { stdio: npmStdio, cwd: currentWorktree });
} catch (err) {
  if (!verbose) process.stderr.write(err.stderr ?? err.stdout ?? "");
  console.error("Error: npm install failed.");
  process.exit(1);
}

log("\nRunning npm run build...");
try {
  execSync("npm run build", { stdio: npmStdio, cwd: currentWorktree });
} catch (err) {
  if (!verbose) process.stderr.write(err.stderr ?? err.stdout ?? "");
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
