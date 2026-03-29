---
name: guide-worktree-local-env
description: >-
  Blueprint for implementing a worktree-based concurrent local environment system in a repository.
compatibility: Requires git. Template scripts are in Node.js but the approach works with any runtime.
license: CC0 1.0
metadata:
  author: Paleo
  version: "0.2.0"
  repository: https://github.com/paleo/skills
---

# Implementing Worktree-Based Concurrent Local Environments

This skill helps you implement a system for running multiple local development environments simultaneously using git worktrees. It is meant to be adapted to any repository, regardless of tech stack or database engine.

The `assets/` directory contains template scripts ([setup-worktree.mjs](assets/setup-worktree.mjs), [dev-agent.mjs](assets/dev-agent.mjs)) and a template for [agent documentation](assets/agent-local-env.md). The scripts are annotated with `ADAPT` comments to highlight what needs changing.

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

Each worktree gets a unique "slot" that determines its port(s). A central **slot registry** (a JSON file stored in a shared directory) tracks which slots are assigned to which worktrees.

**Design the port scheme based on how many ports each environment needs.** The template script uses a step of 10 between slots, which leaves room for multiple ports per environment (e.g. frontend=8110, server=8111). Some examples:

- A project with a frontend port and a server port could use slots 8110–8190 (step of 10), assigning e.g. frontend=8110, server=8111.
- A project with frontend, server, and database ports could also use a step of 10, assigning e.g. frontend=8110, server=8111, db=8112.
- A project with only a single port could simplify to a step of 1 (e.g. slots 8101–8109). In that case, remove the `PORT_STEP` constant, the modulo check in `isValidPort()`, and the secondary port derivation (`adminUiPort`) from the template script.

The slot is identified by the primary port number itself (e.g., `--slot 8120`).

**Registry format** (stored in a shared directory, e.g. `.local/worktree-slots.json`):

```json
{
  "slots": {
    "8110": { "worktree": "/absolute/path/to/myproject-feat-214", "branch": "feat/214" },
    "8130": { "worktree": "/absolute/path/to/myproject-feat-234", "branch": "feat/234" }
  }
}
```

The main worktree's port is implicit and never stored in the registry.

### Config files must be gitignored

The actual config files that contain ports (`.env`, `config.json`, `docker-compose.override.yml`, etc.) **must be gitignored**. This is essential: since all worktrees share the same git history, a tracked config file would be the same everywhere, defeating the purpose of per-worktree port assignment.

Instead, the repo contains checked-in _example_ config files (e.g., `config.example.json`, `.env.example`). The setup script reads these templates, patches in the assigned port(s), and writes the actual config files. This way, the template stays in version control, each worktree gets its own config with unique ports, and the script always produces a valid config.

## The Two Scripts

### 1. `setup-worktree` — Worktree lifecycle management

This is the central piece. It handles the full worktree lifecycle: creation, setup, and removal. It can create a worktree for an existing branch, create a new branch with automatic deduplication, set up the local environment, and tear everything down.

See [assets/setup-worktree.mjs](assets/setup-worktree.mjs) for a template implementation.

**What it does for setup (with `--checkout` or `--create`):**

1. **Creates the worktree.** Computes the worktree path automatically (`../<reponame>-<sanitized-branch>`) to prevent misplacement. With `--create`, handles branch name deduplication (appends `-2`, `-3`, etc. if the branch already exists).
2. **Detects worktrees.** Finds the main worktree path via `git rev-parse --git-common-dir` (the parent of `.git`).
3. **Assigns a slot.** Auto-assigns the first available port, or accepts `--slot PORT` for a specific one. Writes the assignment to the slot registry in the main worktree's shared directory.
4. **Creates per-worktree directories.**
5. **Symlinks shared directories** to the main worktree using relative paths.
6. **Provisions the database.** The goal is that the worktree ends up with a working database. How depends on the project (see "Database provisioning" below).
7. **Generates config files** from example templates with ports patched in.
8. **Installs dependencies and builds** (or whatever your project needs for a cold start).
9. **Prints a summary** with the assigned slot, branch name, and URLs.

**What it does for removal (with `--remove`):**

1. **Looks up the branch** in the slot registry to find the worktree path and slot.
2. **Checks the remote** (unless `--no-remote-check`): verifies the branch has been removed from the remote before proceeding.
3. **Stops the dev server** if running (reads the PID file, kills the process group).
4. **Frees the slot** from the registry.
5. **Removes the worktree** directory via `git worktree remove --force` (force is needed because per-worktree directories contain untracked files).

**CLI flags:**

| Flag | Purpose |
| --- | --- |
| `--checkout BRANCH` | Create a worktree for an existing branch, then set up the local environment |
| `--create BRANCH` | Create a new branch (with suffix dedup) + worktree, then set up the local environment |
| `--self` | Set up the local environment in the current linked worktree |
| `--remove BRANCH` | Stop dev server + free slot + remove worktree by branch name |
| `--remove-self` | Remove the current linked worktree (same as `--remove`, but for the worktree you are in) |
| `--no-remote-check` | Skip remote branch verification when removing (use with `--remove` or `--remove-self`) |
| `--slot PORT` | Use a specific slot instead of auto-assigning |
| `--force` | Overwrite existing config files and re-provision the database |
| `--verbose` | Show intermediate output |

Running the script with no mode flag shows help.

**What to adapt:**

- **Config files**: Identify which files need port patching. It could be an `.env`, a `config.json`, a `docker-compose.override.yml`, or several of these.
- **Per-worktree directories**: Choose what your project needs (database files, caches, logs, Docker volumes...).
- **Build step**: `npm install && npm run build`, `pip install`, `cargo build`, `docker compose build`, etc.
- **Dev server PID file path**: Must match the path used by the `dev-agent` script so `--remove` can stop the server.

### Database provisioning

Each worktree needs its own database instance. The setup script must produce a working database — how it does so depends entirely on your stack.

**File-based databases (SQLite, etc.):** If your database is stored as files on disk, the setup script can simply copy the data directory from the main worktree. This gives the new worktree a clone of the current data. This is the simplest case.

**Docker-managed databases (PostgreSQL, MySQL, etc.):** The typical approach would be:

1. Generate a `docker-compose.override.yml` (or `.env`) with slot-derived ports, so each worktree's database container listens on a unique port.
2. Start the container (`docker compose up -d`).
3. Create a fresh database (or the container creates one on first start).
4. Run migrations to set up the schema.
5. Run a seed script to populate initial data.

The slot port can also serve as the basis for naming: e.g., database `myapp_dev_5001` for slot 5001, so databases don't collide even if they share the same database server.

**The principle is the same regardless of tech:** the setup script must end with a worktree that has a functional database, ready for development. What "functional" means and how to get there is project-specific.

### 2. `dev-agent` — Background dev server management

This script starts the dev server in the background, waits for it to be ready, and returns. It's designed for AI agents that need to start a dev server, do their work, and stop it — without an interactive terminal.

See [assets/dev-agent.mjs](assets/dev-agent.mjs) for a template implementation.

**What it does:**

1. Reads the server port from the config file (which was generated by the setup script).
2. Checks if the port is already in use.
3. Optionally starts infrastructure services (e.g., `docker compose up -d`) before the dev server.
4. Spawns the dev command as a detached process group, redirecting stdout/stderr to a log file.
5. Polls the log file for a success marker string (e.g., `"Server is ready on port"`).
6. Writes the PID to a file.

**Two-tier shutdown:**

The `dev-agent` script intentionally only manages dev server processes, not infrastructure services. This creates a clean separation:

- **`--stop` (dev-agent)**: Kills dev server processes only. Leaves infrastructure (Docker containers, databases) running. This is the common case — the developer pauses work but may come back soon. Restarting dev servers is fast; restarting database containers is not.
- **`--remove` (setup-worktree)**: Full cleanup — stops the dev server, stops infrastructure services, removes containers/volumes, releases the slot, and removes the worktree directory. This is for when the worktree is being torn down entirely.

This separation matters because infrastructure services (databases, caches) are expensive to restart: they need to initialize, and the dev server may need to run migrations or wait for readiness. Dev servers, by contrast, start in seconds. Coupling their lifecycles wastes time on every stop/start cycle.

**What to adapt:**

- **Config path**: Point to wherever your config file lives.
- **Success marker**: Change to whatever your dev server prints when it's ready (e.g., `"Listening on"`, `"Server started"`, `"ready in"`).
- **Start command**: Change to whatever starts your dev server.
- **Infrastructure startup**: If your project uses Docker Compose for databases or other services, add a `docker compose up -d` call at the beginning of the start function (before spawning the dev server). This is idempotent — it no-ops if containers are already running.

## Workflow

### Setting up a new local environment

```sh
npm run setup-worktree -- --checkout feat/42     # existing branch
npm run setup-worktree -- --create feat/42       # new branch (dedup: appends -2, -3… if taken)
npm run setup-worktree -- --self                 # manual worktree (created with git worktree add)

# Start developing
npm run dev
# Or, for agents:
npm run dev:agent
```

### Removing a local environment

```sh
npm run setup-worktree -- --remove feat/42       # remove by branch name
npm run setup-worktree -- --remove-self          # remove the current worktree
npm run setup-worktree -- --remove feat/42 --no-remote-check # skip remote branch check
```

`--remove-self` prints the main worktree path. The parent shell's CWD will point to a deleted directory — run `cd <main-worktree>` afterward.

### Stopping dev servers (keeping infrastructure)

```sh
npm run dev:agent:stop   # Stop dev servers only — Docker containers keep running
npm run dev:agent        # Later, restart quickly
```

### Creating a worktree without setup

When you only need a worktree (no slot, no config, no install), use `git worktree` CLI directly.

### npm scripts to add

```json
{
  "setup-worktree": "node scripts/setup-worktree.mjs",
  "dev:agent": "node scripts/dev-agent.mjs",
  "dev:agent:stop": "node scripts/dev-agent.mjs --stop"
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
- [ ] **Decide on a success marker.** What does your dev server print when it's ready? This is needed for `dev-agent`.
- [ ] **Write `setup-worktree`** using [assets/setup-worktree.mjs](assets/setup-worktree.mjs) as a starting point. Search for `ADAPT` comments.
- [ ] **Write `dev-agent`** using [assets/dev-agent.mjs](assets/dev-agent.mjs) as a starting point. Same approach.
- [ ] **Add npm scripts** (or Makefile targets, etc.) for `setup-worktree`, `dev:agent`, `dev:agent:stop`.
- [ ] **Update `.gitignore`** to ignore your shared and per-worktree directories.
- [ ] **Write agent documentation** if applicable (see [assets/agent-local-env.md](assets/agent-local-env.md)).
- [ ] **Update your main instruction file** (`AGENTS.md` / `CLAUDE.md`) with a pointer to the agent documentation and any conventions (branch naming, commit messages) the agent needs to follow.
