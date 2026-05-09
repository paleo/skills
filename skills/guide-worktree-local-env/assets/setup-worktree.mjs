// =============================================================================
// Template: setup-worktree.mjs
//
// Worktree lifecycle management: creation, setup, and removal.
//
// This template uses a port step of 10, giving each worktree room for multiple
// ports (e.g., slot 8110 → server 8110, frontend 8111, db 8112). For
// single-port projects, simplify: remove PORT_STEP, the modulo check in
// isValidPort(), and the secondary port derivation in computePorts().
//
// Search for "ADAPT" to find all project-specific sections.
// =============================================================================

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
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

// ADAPT: Add one entry per PID file your `dev-server` writes (must match dev-server.mjs).
const DEV_SERVER_PID_FILES = [".local-data/dev-server.pid"];

const CLI_OPTIONS = {
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

let verbose = false;
function log(msg) {
  if (verbose) console.log(msg);
}

main();

function main() {
  const args = parseCliArgs();
  verbose = args.verbose ?? false;

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  validateFlags(args);

  if (!isSetupMode(args) && !isRemoveMode(args)) {
    printHelp();
    process.exit(0);
  }

  const ctx = detectWorktree();
  enforceWorktreeMode(args, ctx);

  if (isRemoveMode(args)) {
    handleRemove(args, ctx);
    process.exit(0);
  }

  validateSlotAvailability(args, ctx);

  const setupCtx = ensureWorktree(args, ctx);
  const branch = getCurrentBranch(setupCtx.currentWorktree);
  const slot = resolveAndRegisterSlot(args, setupCtx, branch);
  const ports = computePorts(slot);

  log(`Using slot ${slot} (server: ${ports.server}, frontend: ${ports.frontend}, db: ${ports.db})`);

  setupLocalDirectories(setupCtx.currentWorktree);
  linkSharedDirectories(setupCtx);
  generateConfigFiles(setupCtx, slot, ports, args.force);

  provisionDatabase(setupCtx.currentWorktree);
  installAndBuild(setupCtx.currentWorktree);
  runMigrationsAndSeed(setupCtx.currentWorktree);

  printSummary(slot, branch, ports);
}

function parseCliArgs() {
  const { values } = parseArgs({ options: CLI_OPTIONS, strict: true });
  return values;
}

function printHelp() {
  console.log("Usage: setup-worktree [options]\n");
  console.log("Manage worktree lifecycle: creation, local environment setup, and removal.\n");
  for (const [name, opt] of Object.entries(CLI_OPTIONS)) {
    const shortFlag = opt.short ? `-${opt.short}, ` : "";
    const argSuffix = opt.arg ? ` <${opt.arg}>` : "";
    const flag = `${shortFlag}--${name}${argSuffix}`;
    console.log(`  ${flag.padEnd(28)} ${opt.description}`);
  }
}

function isRemoveMode(args) {
  return args.remove !== undefined || Boolean(args["remove-self"]);
}

function isSetupMode(args) {
  return args.checkout !== undefined || args.create !== undefined || Boolean(args.self);
}

function validateFlags(args) {
  const modeFlags = [args.checkout, args.create, args.self, isRemoveMode(args)].filter(Boolean);
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

  if ((args.slot !== undefined || args.force) && !isSetupMode(args)) {
    console.error(
      "Error: --slot and --force can only be used with --checkout, --create, or --self.",
    );
    process.exit(1);
  }

  if (args["no-remote-check"] && !isRemoveMode(args)) {
    console.error("Error: --no-remote-check is only valid with --remove or --remove-self.");
    process.exit(1);
  }
}

function detectWorktree() {
  const currentWorktree = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  const gitCommonDir = execSync("git rev-parse --path-format=absolute --git-common-dir", {
    encoding: "utf-8",
  }).trim();
  const mainWorktree = dirname(gitCommonDir);
  const isMainWorktree = resolve(currentWorktree) === resolve(mainWorktree);
  return { currentWorktree, mainWorktree, isMainWorktree };
}

function enforceWorktreeMode(args, ctx) {
  if (args.checkout || args.create) {
    if (!ctx.isMainWorktree) {
      console.error("Error: --checkout and --create must be run from the main worktree.");
      process.exit(1);
    }
  } else if (args.self) {
    if (ctx.isMainWorktree) {
      console.error(
        "Error: --self must be run from a linked worktree, not from the main worktree.",
      );
      process.exit(1);
    }
  }
}

function validateSlotAvailability(args, ctx) {
  if (args.slot === undefined) return;
  const port = Number(args.slot);
  if (!isValidPort(port)) {
    console.error(`Error: Slot must be a valid port: ${allPorts().join(", ")}.`);
    process.exit(1);
  }
  const registry = readSlots(ctx.mainWorktree);
  const existing = registry.slots[String(port)];
  if (existing && resolve(existing.worktree) !== resolve(ctx.currentWorktree)) {
    console.error(
      `Error: Slot ${port} is already taken by ${existing.worktree} (branch: ${existing.branch}).`,
    );
    process.exit(1);
  }
}

function ensureWorktree(args, ctx) {
  if (args.checkout) return checkoutBranch(args.checkout, ctx);
  if (args.create) return createBranch(args.create, ctx);
  return ctx;
}

function checkoutBranch(branch, ctx) {
  const stdio = verbose ? "inherit" : "pipe";
  if (!branchExists(branch)) {
    console.error(`Error: Branch "${branch}" does not exist locally or on the remote.`);
    process.exit(1);
  }
  const worktreePath = computeWorktreePath(ctx.mainWorktree, branch);
  execSync(`git worktree add ${worktreePath} ${branch}`, { stdio });
  return { ...ctx, currentWorktree: worktreePath, isMainWorktree: false };
}

function createBranch(requestedBranch, ctx) {
  const stdio = verbose ? "inherit" : "pipe";
  let finalBranch = requestedBranch;
  if (branchExists(finalBranch)) {
    let suffix = 2;
    while (branchExists(`${requestedBranch}-${suffix}`)) {
      ++suffix;
    }
    finalBranch = `${requestedBranch}-${suffix}`;
  }
  const worktreePath = computeWorktreePath(ctx.mainWorktree, finalBranch);
  execSync(`git worktree add -b ${finalBranch} ${worktreePath}`, { stdio });
  console.log(`Branch: ${finalBranch}`);
  return { ...ctx, currentWorktree: worktreePath, isMainWorktree: false };
}

function handleRemove(args, ctx) {
  const removeSelf = Boolean(args["remove-self"]);
  const registry = readSlots(ctx.mainWorktree);
  const target = resolveRemoveTarget(args, ctx, registry, removeSelf);

  if (!args["no-remote-check"]) {
    verifyBranchAbsentFromRemote(target.branch);
  }

  if (!existsSync(target.worktreePath)) {
    console.warn(
      `Warning: Worktree directory ${target.worktreePath} not found. Cleaning up registry only.`,
    );
    delete registry.slots[target.slotPort];
    writeSlots(ctx.mainWorktree, registry);
    console.log(`Removed registry entry for branch "${target.branch}" (slot ${target.slotPort}).`);
    return;
  }

  stopDevServer(target.worktreePath);
  stopDockerStack(target.worktreePath);

  delete registry.slots[target.slotPort];
  writeSlots(ctx.mainWorktree, registry);

  if (removeSelf) {
    process.chdir(ctx.mainWorktree);
  }

  execSync(`git worktree remove --force ${target.worktreePath}`, {
    stdio: verbose ? "inherit" : "pipe",
  });

  console.log(`Removed worktree for branch "${target.branch}" (slot ${target.slotPort}).`);
  if (removeSelf) {
    console.log(`Now run: cd ${ctx.mainWorktree}`);
  }
}

function resolveRemoveTarget(args, ctx, registry, removeSelf) {
  if (removeSelf) {
    if (ctx.isMainWorktree) {
      console.error("Error: Cannot remove the main worktree.");
      process.exit(1);
    }
    const resolvedCurrent = resolve(ctx.currentWorktree);
    const entry = Object.entries(registry.slots).find(
      ([, v]) => resolve(v.worktree) === resolvedCurrent,
    );
    if (!entry) {
      console.error("Error: No slot found for this worktree in the registry.");
      process.exit(1);
    }
    return { slotPort: entry[0], branch: entry[1].branch, worktreePath: ctx.currentWorktree };
  }

  const branch = args.remove;
  const entry = Object.entries(registry.slots).find(([, v]) => v.branch === branch);
  if (!entry) {
    console.error(`Error: No worktree found for branch "${branch}" in the slot registry.`);
    process.exit(1);
  }
  const worktreePath = entry[1].worktree;
  if (resolve(ctx.currentWorktree) === resolve(worktreePath)) {
    console.error("Error: You are currently in this worktree. Use --remove-self instead.");
    process.exit(1);
  }
  return { slotPort: entry[0], branch, worktreePath };
}

function verifyBranchAbsentFromRemote(branch) {
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

// ADAPT: Remove this function (and its call in handleRemove) if your project doesn't use Docker.
function stopDockerStack(worktreePath) {
  log("Stopping Docker container...");
  try {
    execSync("docker compose down -v", {
      stdio: verbose ? "inherit" : "pipe",
      cwd: worktreePath,
    });
  } catch {
    log("Warning: docker compose down failed (container may not exist).");
  }
}

function getCurrentBranch(worktreePath) {
  return execSync("git branch --show-current", {
    encoding: "utf-8",
    cwd: worktreePath,
  }).trim();
}

function resolveAndRegisterSlot(args, ctx, branch) {
  const registry = readSlots(ctx.mainWorktree);
  const port = pickSlotPort(args, ctx, registry);
  registry.slots[String(port)] = { worktree: ctx.currentWorktree, branch };
  writeSlots(ctx.mainWorktree, registry);
  return port;
}

function pickSlotPort(args, ctx, registry) {
  const resolvedCurrent = resolve(ctx.currentWorktree);

  if (args.slot !== undefined) {
    const port = Number(args.slot);
    if (!isValidPort(port)) {
      console.error(`Error: Slot must be a valid port: ${allPorts().join(", ")}.`);
      process.exit(1);
    }
    const existing = registry.slots[String(port)];
    if (existing && resolve(existing.worktree) !== resolvedCurrent) {
      console.error(
        `Error: Slot ${port} is already taken by ${existing.worktree} (branch: ${existing.branch}).`,
      );
      process.exit(1);
    }
    return port;
  }

  const existingEntry = Object.entries(registry.slots).find(
    ([, v]) => resolve(v.worktree) === resolvedCurrent,
  );
  if (existingEntry) return Number(existingEntry[0]);

  for (const port of allPorts()) {
    if (!registry.slots[String(port)]) return port;
  }
  console.error("Error: All slots are taken. Remove a worktree with --remove first.");
  process.exit(1);
}

// ADAPT: Derive additional ports from the slot's primary port. The slot value
// is the `server` port; adjust the keys and offsets to match your project.
function computePorts(slot) {
  return { server: slot, frontend: slot + 1, db: slot + 2 };
}

function setupLocalDirectories(worktreePath) {
  // ADAPT: List the per-worktree directories your project needs.
  const localDataDirs = [".local-data", ".local-data/logs"];
  for (const dir of localDataDirs) {
    mkdirSync(join(worktreePath, dir), { recursive: true });
  }
}

function linkSharedDirectories(ctx) {
  // ADAPT: List the gitignored directories that should be shared across worktrees.
  for (const dirName of [".local", ".plans"]) {
    const link = join(ctx.currentWorktree, dirName);
    const mainDir = join(ctx.mainWorktree, dirName);
    if (!existsSync(mainDir)) {
      log(`Skipped ${dirName} symlink (not present in main worktree).`);
    } else if (existsSync(link)) {
      log(`Skipped ${dirName} symlink (already exists).`);
    } else {
      const relTarget = relative(ctx.currentWorktree, mainDir);
      symlinkSync(relTarget, link);
      log(`Created ${dirName} symlink → main worktree.`);
    }
  }
}

// ADAPT: For each gitignored config file your project needs, call
// copyAndPatchFile. The source is the same path in the main worktree (which
// the developer set up once from the .example file). Patch ports / hosts as
// needed.
function generateConfigFiles(ctx, slot, ports, force) {
  copyAndPatchFile(ctx, ".env", (content) => patchAppEnv(content, ports), ".env", force);

  // ADAPT: Docker-managed DB example (PostgreSQL). Patch the host port and
  // container name in docker-compose.yml so each worktree's DB is isolated.
  // Remove this entry if your project doesn't use Docker.
  copyAndPatchFile(
    ctx,
    "docker-compose.yml",
    (content) => patchDockerCompose(content, ctx.mainWorktree, slot, ports.db),
    "docker-compose.yml",
    force,
  );
}

function patchAppEnv(content, ports) {
  // ADAPT: For URL-style env values, use extractHost to preserve non-localhost
  // hosts configured in the main worktree. Example:
  //
  //   const apiHost = extractHost(content, "API_URL");
  //   return patchEnvFile(content, {
  //     SERVER_PORT: String(ports.server),
  //     API_URL: `http://${apiHost}:${ports.server}`,
  //   });
  return patchEnvFile(content, {
    PORT: String(ports.frontend),
    SERVER_PORT: String(ports.server),
  });
}

function patchDockerCompose(content, mainWorktree, slot, dbPort) {
  const repoName = basename(mainWorktree);
  let patched = content.replace(/^(\s*-\s*")[^"]*:5432(")/m, `$1${dbPort}:5432$2`);
  patched = patched.replace(
    /^(\s*container_name:\s*).+$/m,
    `$1${repoName}-database-slot-${slot}`,
  );
  return patched;
}

// ALTERNATIVE: file-based DB (SQLite, etc.) — replace generateConfigFiles'
// docker-compose.yml entry and provisionDatabase with a copy from the main
// worktree. Example:
//
//   import { cpSync, readdirSync } from "node:fs";
//   function provisionDatabase(worktreePath, mainWorktree, force) {
//     const localDataDir = join(worktreePath, ".local-data/data");
//     const mainDataDir = join(mainWorktree, ".local-data/data");
//     mkdirSync(localDataDir, { recursive: true });
//     const entries = readdirSync(localDataDir);
//     if (entries.length > 0 && !force) {
//       log("Skipping database copy (.local-data/data/ is not empty; use --force to overwrite).");
//       return;
//     }
//     if (!existsSync(mainDataDir)) {
//       log("No .local-data/data/ in main worktree, skipping database copy.");
//       return;
//     }
//     log("Copying databases from main worktree...");
//     cpSync(mainDataDir, localDataDir, { recursive: true, force: true });
//   }

function provisionDatabase(worktreePath) {
  const stdio = verbose ? "inherit" : "pipe";
  log("\nStarting database container...");
  try {
    execSync("docker compose up -d", { stdio, cwd: worktreePath });
  } catch (err) {
    if (!verbose) process.stderr.write(err.stderr ?? err.stdout ?? "");
    console.error("Error: docker compose up failed.");
    process.exit(1);
  }

  // ADAPT: Service name `database` matches docker-compose.yml. Adjust if yours
  // uses a different name.
  log("Waiting for database to be ready...");
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      execSync("docker compose exec database pg_isready", {
        stdio: "pipe",
        cwd: worktreePath,
      });
      log("Database is ready.");
      return;
    } catch {
      execSync("sleep 1");
    }
  }
  console.error("Error: Database did not become ready within 30s.");
  process.exit(1);
}

// ADAPT: Replace with your project's install and build commands.
function installAndBuild(worktreePath) {
  runCommand("npm install", worktreePath, "npm install");
  runCommand("npm run build", worktreePath, "npm run build");
}

// ADAPT: Replace with your project's migration and seed commands.
function runMigrationsAndSeed(worktreePath) {
  log("\nRunning migrations...");
  runCommand("npm run migrate", worktreePath, "migrate");
  log("Running seed...");
  runCommand("npm run seed", worktreePath, "seed");
}

function runCommand(command, worktreePath, label) {
  const stdio = verbose ? "inherit" : "pipe";
  log(`\nRunning ${command}...`);
  try {
    execSync(command, { stdio, cwd: worktreePath });
  } catch (err) {
    if (!verbose) process.stderr.write(err.stderr ?? err.stdout ?? "");
    console.error(`Error: ${label} failed.`);
    process.exit(1);
  }
}

// ADAPT: Print URLs relevant to your project.
function printSummary(slot, branch, ports) {
  console.log(`
Worktree setup complete!
  Slot:     ${slot}
  Branch:   ${branch}
  Server:   http://localhost:${ports.server}/
  Frontend: http://localhost:${ports.frontend}/
  DB port:  ${ports.db}
`);
}

// --- Leaf utilities ---

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

function readSlots(mainWorktree) {
  const filePath = join(mainWorktree, SLOTS_FILE);
  if (!existsSync(filePath)) return { slots: {} };
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeSlots(mainWorktree, registry) {
  const filePath = join(mainWorktree, SLOTS_FILE);
  mkdirSync(join(mainWorktree, ".local"), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(registry, undefined, 2)}\n`);
}

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

function stopDevServer(worktreePath) {
  for (const pidFileRel of DEV_SERVER_PID_FILES) {
    const pidFile = join(worktreePath, pidFileRel);
    if (!existsSync(pidFile)) continue;

    const raw = readFileSync(pidFile, "utf-8").trim();
    const pid = Number(raw);
    if (!Number.isInteger(pid) || pid <= 0) continue;

    try {
      process.kill(pid, 0); // check if alive
    } catch {
      unlinkSync(pidFile);
      continue;
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
}

/**
 * Patch one or more `KEY=VALUE` lines in an env-style file. Adds the line if
 * the key is missing.
 */
function patchEnvFile(content, patches) {
  const lines = content.trimEnd().split("\n");
  for (const [key, value] of Object.entries(patches)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx !== -1) {
      lines[idx] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Preserve the host configured in the main worktree (e.g. a remote dev
 * server's public IP) so a new worktree's URLs aren't silently rewritten to
 * `localhost`. Use this when patching URL-style env values like
 * `API_URL=http://1.2.3.4:8001`.
 */
function extractHost(content, key, fallback = "localhost") {
  const re = new RegExp(`^${key}=(?:https?://)?([^:\\s]+)`, "m");
  const m = content.match(re);
  return m ? m[1] : fallback;
}

/**
 * Copy a gitignored config file from the main worktree into the current
 * worktree, applying `patchFn` to its content. Honors `--force`. Warns and
 * skips if the source is missing in the main worktree.
 */
function copyAndPatchFile(ctx, relPath, patchFn, label, force) {
  const targetPath = join(ctx.currentWorktree, relPath);
  const sourcePath = join(ctx.mainWorktree, relPath);
  const alreadyExists = existsSync(targetPath);

  if (alreadyExists && !force) {
    log(`Skipped ${label} (already exists; use --force to overwrite).`);
    return;
  }

  if (!existsSync(sourcePath)) {
    log(`Warning: ${relPath} not found in main worktree, skipping.`);
    return;
  }

  const content = readFileSync(sourcePath, "utf-8");
  const patched = patchFn(content);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, patched);
  log(`${alreadyExists ? "Overwritten" : "Created"} ${label}.`);
}
