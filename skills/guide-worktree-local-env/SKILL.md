---
name: guide-worktree-local-env
description: >-
  Blueprint for implementing a worktree-based concurrent local environment system in a repository.
compatibility: Requires git. Template scripts are in Node.js but the approach works with any runtime.
license: CC0 1.0
metadata:
  author: Paleo
  version: "0.3.0"
  repository: https://github.com/paleo/skills
---

# Implementing Worktree-Based Concurrent Local Environments

This skill helps you implement a system for running multiple local development environments simultaneously using git worktrees. It is meant to be adapted to any repository, regardless of tech stack or database engine.

The `assets/` directory contains template scripts ([setup-worktree.mjs](assets/setup-worktree.mjs), [dev-server.mjs](assets/dev-server.mjs)) and a template for [agent documentation](assets/agent-local-env.md). The scripts are annotated with `ADAPT` comments to highlight what needs changing.

These `.mjs` files are templates, not finished scripts. Once you've adapted them to your project, strip out everything you don't use: `ADAPT` / `ALTERNATIVE` comments, the inline examples (e.g. the `extractHost` URL-patching example, the SQLite-alternative block), unused branches, and any defaults you replaced. The committed script should read like a normal first-class part of your codebase, with no template scaffolding left behind.

## The Problem

When you work on multiple branches at the same time (or when AI agents work in parallel), you need isolated environments. Git worktrees give you isolated _code_, but that's not enough: each environment also needs its own ports, its own database, and its own config files. Without automation, setting this up manually for every branch is tedious and error-prone.

## Core Concepts

### Shared vs per-worktree gitignored directories

The first thing to decide is: for each gitignored directory in your project, should it be **shared** across worktrees or **isolated** per worktree?

- **Shared directories** are symlinked in worktrees (pointing to the main worktree). They contain things that should be the same everywhere: the slot registry, personal notes, task plans, etc.
- **Per-worktree directories** are created independently in each worktree. They contain things that must differ: databases, caches, logs, PID files, Docker volumes, etc.

Example split:

| Directory      | Shared or per-worktree | Contents                         |
| -------------- | ---------------------- | -------------------------------- |
| `.local/`      | Shared (symlinked)     | Slot registry, personal notes    |
| `.plans/`      | Shared (symlinked)     | Task planning files              |
| `.local-data/` | Per-worktree           | Databases, caches, backups, logs |

The setup script creates symlinks for shared directories and creates fresh copies of per-worktree directories. The naming doesn't matter — what matters is that you consciously decide which category each directory falls into.

### Contiguous port scheme

Most projects have scattered default ports: server on 3000, database on 5432, Redis on 6379, frontend on 5173, etc. For the worktree system to work, **all ports must be made configurable and reorganized into a contiguous range** so they can be derived from a single slot number.

For example, a project that originally uses ports 3000, 5432, and 5173 would be reconfigured to use 8100, 8101, and 8102 in the main worktree — and 8110, 8111, and 8112 in worktree slot 8110. This is a one-time migration of the project's dev environment configuration.

**Choose a base port that starts a range of at least 200 contiguous ports that are free on all common operating systems.** Port 8100 is a safe default (range 8100–8299). If a user proposes a different base — such as 8000, which conflicts with common HTTP alternate ports on some systems — advise them to pick a safer one.

Note: Services that run in Docker (like a database) can have their host port remapped without changing the container's internal port.

### Slot-based port allocation

Each worktree gets a unique "slot" that determines its port(s). A central **slot registry** (a JSON file stored in a shared directory) tracks which slots are assigned to which worktrees. The template ships with 19 linked-worktree slots; the main worktree is implicit, for 20 workspaces total.

**Design the port scheme based on how many ports each environment needs.** The template script uses a step of 10 between slots, which leaves room for multiple ports per environment (e.g. frontend=8110, server=8111). Some examples:

- A project with a frontend port and a server port could use slots 8110–8190 (step of 10), assigning e.g. frontend=8110, server=8111.
- A project with frontend, server, and database ports could also use a step of 10, assigning e.g. frontend=8110, server=8111, db=8112.
- A project with only a single port could simplify to a step of 1 (e.g. slots 8101–8109). In that case, remove the `PORT_STEP` constant, the modulo check in `isValidPort()`, and any secondary port derivation from the template script.

The slot is identified by the primary port number itself (e.g., `--slot 8120`).

**Registry format** (stored in a shared directory, e.g. `.local/worktrees/slots.json`):

```json
{
  "slots": {
    "8110": { "worktree": "/absolute/path/to/myproject-feat-214", "branch": "feat/214", "owner": "alice" },
    "8130": { "worktree": "/absolute/path/to/myproject-feat-234", "branch": "feat/234", "owner": "default" }
  }
}
```

The main worktree's port is implicit and never stored in the registry.

### Concurrent dev-server cap

Host RAM is shared. Without a cap, parallel dev-servers (especially when an AI bot fans out worktrees) can exhaust memory. The template enforces a cap on every `dev:up`.

Resolution order for the limit:

1. `<PROJECT>_DEV_LIMIT` (project-specific env var name set via an `ADAPT` constant; e.g. `MYAPP_DEV_LIMIT`).
2. `PROJECT_DEV_LIMIT` (cross-project default — set once in shell rc).
3. Hardcoded `DEV_LIMIT_DEFAULT = 5`.

`0` means unlimited. Empty / unset / non-numeric values fall through to the next candidate.

A second registry, `.local/worktrees/dev-servers.json`, tracks live dev-servers. It lives in the main worktree's shared directory; linked worktrees reach it via the existing `.local` symlink. An entry is **live** if at least one PID in its `pids` map is alive; dead entries are pruned on every read. When `live >= limit`, `dev:up` aborts and lists the active servers (slot, branch, owner, pids, started-at, worktree path).

### Config files must be gitignored

The actual config files that contain ports (`.env`, `config.json`, `docker-compose.override.yml`, etc.) **must be gitignored**. This is essential: since all worktrees share the same git history, a tracked config file would be the same everywhere, defeating the purpose of per-worktree port assignment.

The repo contains checked-in _example_ config files (e.g., `.env.example`, `config.example.json`). The setup uses a **two-stage flow**:

1. **Once per repo**, the developer manually creates the main worktree's actual config from the `.example` file (`cp .env.example .env`) and customizes it as needed (e.g., a remote dev-server IP for `API_URL`, secrets, feature flags).
2. **For every sibling worktree**, the setup script copies the main worktree's actual config and patches in the slot's ports. This propagates the developer's customizations automatically.

This means dev-time customizations (a public dev IP, alternate hosts, etc.) flow into new worktrees "for free". The `extractHost` helper preserves non-localhost hosts when patching URL-style env values, so a `API_URL=http://1.2.3.4:8001` becomes `http://1.2.3.4:<newPort>` rather than collapsing to `localhost`.

Trade-off: mistakes in the main worktree's config also propagate. Keep it clean.

## The Two Scripts

### 1. `setup-worktree` — Worktree lifecycle management

This is the central piece. It handles the full worktree lifecycle: creation, setup, and removal. It can create a worktree for an existing branch, create a new branch with automatic deduplication, set up the local environment, and tear everything down.

See [assets/setup-worktree.mjs](assets/setup-worktree.mjs) for a template implementation.

**What it does for setup (with `--use` or `--create`):**

1. **Creates the worktree.** Computes the worktree path automatically (`../<reponame>-<sanitized-branch>`) to prevent misplacement. With `--create`, handles branch name deduplication (appends `-2`, `-3`, etc. if the branch already exists).
2. **Detects worktrees.** Finds the main worktree path via `git rev-parse --git-common-dir` (the parent of `.git`).
3. **Assigns a slot.** Auto-assigns the first available port, or accepts `--slot PORT` for a specific one. Records `worktree`, `branch`, and `owner` (from `--owner`, defaults to `"default"`; preserved on re-setup when `--owner` is omitted) in the slot registry in the main worktree's shared directory.
4. **Creates per-worktree directories.**
5. **Symlinks shared directories** to the main worktree using relative paths.
6. **Provisions the database.** The goal is that the worktree ends up with a working database. How depends on the project (see "Database provisioning" below).
7. **Generates config files** from example templates with ports patched in.
8. **Installs dependencies and builds** (or whatever your project needs for a cold start).
9. **Prints a summary** with the assigned slot, branch name, owner, and URLs.

**What it does for removal (with `--remove`):**

1. **Looks up the branch** in the slot registry to find the worktree path and slot.
2. **Checks the remote** (unless `--no-remote-check`): verifies the branch has been removed from the remote before proceeding.
3. **Stops the dev server** if running (reads the PID file, kills the process group).
4. **Frees the slot** from the registry.
5. **Drops the matching `dev-servers.json` entry** if any.
6. **Removes the worktree** directory via `git worktree remove --force` (force is needed because per-worktree directories contain untracked files).

**CLI flags:**

| Flag | Purpose |
| --- | --- |
| `--use BRANCH` | Create a worktree for an existing branch, then set up the local environment |
| `--create BRANCH` | Create a new branch (with suffix dedup) + worktree, then set up the local environment |
| `--self` | Set up the local environment in the current linked worktree |
| `--owner NAME` | Owner of the slot (free-form label, defaults to `"default"`) |
| `--set-owner NAME` | Update the owner of the current linked worktree's slot — no rebuild |
| `--remove BRANCH` | Stop dev server + free slot + remove worktree by branch name |
| `--remove-self` | Remove the current linked worktree (same as `--remove`, but for the worktree you are in) |
| `--no-remote-check` | Skip remote branch verification when removing (use with `--remove` or `--remove-self`) |
| `--slot PORT` | Use a specific slot instead of auto-assigning |
| `--force` | Overwrite existing config files and re-provision the database |
| `--verbose` | Show intermediate output |

Running the script with no mode flag shows help.

**What to adapt:**

- **Config files**: List `copyAndPatchFile` invocations — one per gitignored config file your project needs. The source is the same path in the main worktree; the patch function inserts the slot's ports (and preserves hosts via `extractHost` for URL-style values).
- **`DEV_SERVER_PID_FILES`**: One entry per PID file your `dev-server` writes. Used by `--remove` to stop the dev server cleanly.
- **Per-worktree directories**: Choose what your project needs (database files, caches, logs, Docker volumes...).
- **Build step**: `npm install && npm run build`, `pip install`, `cargo build`, `docker compose build`, etc.
- **`MAX_SLOT_COUNT`**: Default `19`. Adjust if a different ceiling fits your project.
- **Project-specific `<PROJECT>_DEV_LIMIT` env-var name**: chosen in `dev-server.mjs` and referenced everywhere the cap is documented.

### Database provisioning

Each worktree needs its own database instance. The setup script must produce a working database — how it does so depends entirely on your stack.

**File-based databases (SQLite, etc.):** If your database is stored as files on disk, the setup script can simply copy the data directory from the main worktree. This gives the new worktree a clone of the current data. This is the simplest case.

**Docker-managed databases (PostgreSQL, MySQL, etc.):** The template ships an example flow:

1. Copy `docker-compose.yml` from the main worktree into the new worktree, patching the host port (e.g. `5432`) to the slot's DB port and rewriting `container_name` to include the slot (e.g. `myrepo-database-slot-8110`) so containers don't collide.
2. Start the container with `docker compose up -d`.
3. Wait for the DB to be ready by polling `docker compose exec database pg_isready` with a 30-second deadline.
4. Run migrations to set up the schema.
5. Run a seed script to populate initial data.

The slot port can also serve as the basis for naming: e.g., database `myapp_dev_5001` for slot 5001, so databases don't collide even if they share the same database server.

**The principle is the same regardless of tech:** the setup script must end with a worktree that has a functional database, ready for development. What "functional" means and how to get there is project-specific.

### 2. `dev-server` — Background dev server management

This script starts the dev server in the background, waits for it to be ready, and returns. It's designed for AI agents that need to start a dev server, do their work, and stop it — without an interactive terminal.

A "dev server" can be a single process or several cooperating processes (e.g. an API watcher plus a frontend bundler). The script handles either case via a `SERVERS` array — one entry per process — but conceptually they form one dev server.

See [assets/dev-server.mjs](assets/dev-server.mjs) for a template implementation.

**What it does:**

1. Reads each server's port from its config file (the busy-port check) and verifies no port is already in use.
2. Reads `dev-servers.json`, prunes dead entries, and refuses to start when the live count meets the cap (`<PROJECT>_DEV_LIMIT` → `PROJECT_DEV_LIMIT` → default `5`; `0` = unlimited).
3. Aborts if a sibling `dev-server` is already running (PID file + alive check).
4. Optionally starts infrastructure services in `ensureInfrastructure()` (e.g., `docker compose up -d`) before any dev server. By default this is a no-op.
5. Iterates over the `SERVERS` array, spawning each process as a detached process group with stdout/stderr redirected to a per-process log file and the PID written to a per-process PID file.
6. Polls each log file in parallel for a success marker. Fails fast on any configured fatal `errorMarkers` substring (e.g. `"[ExceptionHandler]"`, Node's `"Node.js v"` exit footer) or if the process dies, instead of waiting for the timeout.
7. On any startup failure, prints the last lines of the failing log, stops every spawned sibling process, and exits non-zero.
8. On success, registers the dev-server in `dev-servers.json` (slot, worktree, branch, owner, pids keyed by `SERVERS[i].name`, `startedAt`) and prints a summary listing each process's URL, PID, and log path.

`dev:list` prints the active dev-servers (sorted by slot). `dev:down --all` runs the SIGTERM-poll-SIGKILL stop logic against every PID in every entry, removes per-worktree PID files, and clears the registry. Neither touches infrastructure.

**Main worktree synthesis:** the main worktree never has a row in `slots.json`. When `dev:up` (or `dev:list` / `dev:down --all`) runs there, it synthesizes an in-memory slot using `BASE_PORT`, the current branch, and `owner: "default"` so the entry still flows through `dev-servers.json` and counts toward the cap.

A single-process dev server uses a `SERVERS` array with one entry; the script's structure stays the same.

**Two-tier shutdown:**

The `dev-server` script intentionally only manages dev server processes, not infrastructure services. This creates a clean separation:

- **`--stop` (dev-server)**: Kills the dev server processes only. Leaves infrastructure (Docker containers, databases) running. This is the common case — the developer pauses work but may come back soon. Restarting the dev server is fast; restarting database containers is not.
- **`--remove` (setup-worktree)**: Full cleanup — stops the dev server, stops infrastructure services, removes containers/volumes, releases the slot, and removes the worktree directory. This is for when the worktree is being torn down entirely.

This separation matters because infrastructure services (databases, caches) are expensive to restart: they need to initialize, and the dev server may need to run migrations or wait for readiness. The dev server, by contrast, starts in seconds. Coupling their lifecycles wastes time on every stop/start cycle.

**What to adapt:**

- **`SERVERS` entries**: One per dev server process. Each entry sets the spawn command, success marker, fatal `errorMarkers`, PID/log paths, and the env file + variable to read the port from.
- **Fatal markers**: Pick log substrings that mean "unrecoverable" for your stack (or leave the array empty). Failing fast on these saves the full timeout.
- **`ensureInfrastructure()`**: Uncomment / extend the `docker compose up -d` call if your project has Docker-managed infrastructure that must run before the dev server.
- **`PROJECT_DEV_LIMIT_VAR`**: set to your project's env-var name (e.g. `MYAPP_DEV_LIMIT`). Adjust `DEV_LIMIT_DEFAULT` if `5` doesn't fit.

## Workflow

### Setting up a new local environment

```sh
npm run setup-worktree -- --use feat/42          # existing branch
npm run setup-worktree -- --create feat/42       # new branch (dedup: appends -2, -3… if taken)
npm run setup-worktree -- --self                 # manual worktree (created with git worktree add)

# Tag a slot's owner (free-form label; useful for AI bots passing a Discord username)
npm run setup-worktree -- --use feat/42 --owner alice
npm run setup-worktree -- --set-owner bob        # update later, no rebuild

# Start developing
npm run dev
# Or, for agents:
npm run dev:up
```

### Removing a local environment

```sh
npm run setup-worktree -- --remove feat/42       # remove by branch name
npm run setup-worktree -- --remove-self          # remove the current worktree
npm run setup-worktree -- --remove feat/42 --no-remote-check # skip remote branch check
```

`--remove-self` prints the main worktree path. The parent shell's CWD will point to a deleted directory — run `cd <main-worktree>` afterward.

### Stopping the dev server (keeping infrastructure)

```sh
npm run dev:down   # Stop the dev server only — Docker containers keep running
npm run dev:up     # Later, restart quickly
```

### Listing and stopping all dev servers

```sh
npm run dev:list             # List active dev-servers across all worktrees
npm run dev:down -- --all    # Stop every active dev-server (infrastructure stays up)
```

### Creating a worktree without setup

When you only need a worktree (no slot, no config, no install), use `git worktree` CLI directly.

### npm scripts to add

```json
{
  "setup-worktree": "node scripts/local-env/setup-worktree.mjs",
  "dev:up": "node scripts/local-env/dev-server.mjs",
  "dev:down": "node scripts/local-env/dev-server.mjs --stop",
  "dev:list": "node scripts/local-env/dev-server.mjs --list"
}
```

## Key Design Decisions and Rationale

**Why symlink shared directories rather than creating separate copies per worktree?**
The slot registry must be shared so all worktrees see the same allocation state. Personal notes and plans should also be accessible from any worktree. Symlinking is the simplest way to achieve this.

**Why does each worktree need its own database?**
Each worktree might run migrations or modify data independently. Sharing a database across concurrent environments would cause conflicts. Each environment gets its own isolated database instance — how that's achieved (file copy, Docker container, etc.) is project-specific.

**Why a Node.js script rather than a shell script?**
The setup logic (JSON parsing, file manipulation, slot allocation) is more maintainable in a real programming language. If your project already has a runtime (Node.js, Python, etc.), writing the script in that language avoids extra dependencies. The template scripts use Node.js, but the approach translates to any language.

**Why detect the main worktree via `git rev-parse --git-common-dir`?**
This works reliably regardless of where worktrees are physically located. The common dir always points to `<main-worktree>/.git`, so its parent is the main worktree.

**Why does the script handle worktree creation instead of relying on manual `git worktree add`?**
Centralizing worktree path computation prevents a common mistake: creating the worktree as a child directory of the main worktree instead of a sibling. The script derives the path automatically from the branch name and the main worktree directory name.

**Why copy configs from the main worktree instead of from `.example` files?**
Sibling worktrees should inherit the developer's main-worktree customizations (e.g., a public dev-server IP overriding `localhost`, alternate hosts, secrets configured once). The `.example` files remain the bootstrap source for the main worktree itself, but stop being the per-worktree source after that — propagating customizations automatically is more valuable than re-deriving from the example each time.

## Agent Instructions

If you use AI coding agents, the worktree system only works if agents know about it. There are two pieces to set up:

### 1. Main instruction file (`AGENTS.md` or `CLAUDE.md`)

This is the file the agent reads on every task. It must contain:

- **Conventions that affect worktrees** — branch naming and commit message conventions, because the agent creates branches when setting up worktrees. For example:

  ```markdown
  Branch naming convention: `<type>/<ticket-id>` (e.g., `feat/123`, `fix/123`).
  Commit message convention: conventional commits, e.g., `feat: [#123] add new feature`.
  ```

- **A pointer to the local-env documentation** — so the agent knows to read it when dealing with worktrees or the dev server. For example:

  ```markdown
  Read when relevant:
  - `docs/agent-local-env.md` — Starting/stopping the dev server, creating/removing worktrees.
  ```

Without the pointer, the agent won't discover the procedures. Without the conventions, it will create branches and commits with inconsistent naming.

### 2. Detailed local-env documentation (`docs/agent-local-env.md`)

This is the file referenced above. It contains the step-by-step procedures: how to create a worktree, how to start the dev server, how to tear things down. See [assets/agent-local-env.md](assets/agent-local-env.md) for a starting point.

The agents need to know:

1. The exact commands to run (the script handles worktree creation, setup, and removal)
2. What guardrails to respect (never delete a branch unless explicitly requested)
3. Where logs and config files live

## Checklist for Adapting to a New Repository

- [ ] **Make all dev ports configurable and contiguous.** Reorganize scattered default ports (3000, 5432, 5173...) into a contiguous range. This is a prerequisite.
- [ ] **Design your port scheme.** How many ports per environment? What's the step between slots? For the base port, use 8100 (or another port that starts a 200-port free range on all common OSes) unless you have a specific reason otherwise.
- [ ] **Identify your config files.** Which files need port patching? Do they already have `.example` versions?
- [ ] **Classify your gitignored directories.** Which are shared (symlinked)? Which are per-worktree?
- [ ] **Decide how to provision the database.** File copy (SQLite)? Docker + migrations + seed (PostgreSQL)? The setup script must end with a working database.
- [ ] **Decide on a success marker.** What does your dev server print when it's ready? This is needed for `dev-server`.
- [ ] **Decide on fatal log markers for `dev-server`** (or leave the array empty). Substrings that mean "unrecoverable startup failure" let the script fail fast instead of waiting for the timeout.
- [ ] **Bootstrap the main worktree's config files manually once** (from `.example` files), since sibling worktrees inherit from the main worktree.
- [ ] **Write `setup-worktree`** using [assets/setup-worktree.mjs](assets/setup-worktree.mjs) as a starting point. Search for `ADAPT` comments.
- [ ] **Write `dev-server`** using [assets/dev-server.mjs](assets/dev-server.mjs) as a starting point. Same approach.
- [ ] **Strip the template scaffolding.** Delete every `ADAPT` / `ALTERNATIVE` comment, inline example, and unused branch from the final scripts. The committed files should read as native to the codebase.
- [ ] **Add npm scripts** (or Makefile targets, etc.) for `setup-worktree`, `dev:up`, `dev:down`.
- [ ] **Choose your project-specific dev-limit env-var name** (`<PROJECT>_DEV_LIMIT`) and review the default cap (`5`).
- [ ] **Update `.gitignore`** to ignore your shared and per-worktree directories. Make sure `.local/worktrees/` is covered (slot registry and dev-server registry live there).
- [ ] **Write agent documentation** if applicable (see [assets/agent-local-env.md](assets/agent-local-env.md)).
- [ ] **Update your main instruction file** (`AGENTS.md` / `CLAUDE.md`) with a pointer to the agent documentation and any conventions (branch naming, commit messages) the agent needs to follow.
