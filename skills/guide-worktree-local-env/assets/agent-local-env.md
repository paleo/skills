---
title: Local Environment Management for Agents
summary: Agent procedures for creating/removing worktrees, starting/stopping the dev server.
read_when:
  - setting up or removing a worktree
  - starting or stopping the dev server
---

# Local Environment Management for Agents

## Setting Up a Local Environment

When the user asks to "set up a new local environment" or "set up a new worktree":

```sh
npm run setup-worktree -- --checkout fix/123  # existing branch
npm run setup-worktree -- --create fix/123    # new branch (dedup: appends -2, -3… if taken)
npm run setup-worktree -- --self              # manual worktree (created with git worktree add)
```

<!-- ADAPT: Update the setup command if your project uses a different task runner.
     Document any project-specific ports or URLs the developer should know about. -->

The script creates the worktree in the correct sibling directory, assigns a port slot, installs dependencies, builds, generates config files, and provisions the database.

### Removing a Local Environment

```sh
npm run setup-worktree -- --remove fix/123    # remove by branch name
npm run setup-worktree -- --remove-self       # remove the current worktree
npm run setup-worktree -- --remove fix/123 --no-remote-check # skip remote branch check
```

Stops the dev server (if running), frees the slot, and removes the worktree.

By default, it verifies the branch has been removed from the remote first. Use `--no-remote-check` to skip that. With `--remove-self`, the script prints the main worktree path. You'll have to run `cd <main-worktree>` afterward.

**NEVER** delete a branch unless the user explicitly requests it.

### Creating a Worktree Without Setup

When the user only wants a worktree (no ports, no build, no config), use `git worktree` CLI directly.

<!-- ADAPT: Replace REPONAME with your repository name in the example if you add one. -->

## Dev Server

`npm run dev:up` starts the dev server in the background with logs redirected to a file, and returns once the server is ready.

```sh
npm run dev:up    # Start in background
npm run dev:down  # Stop the background server
```

<!-- ADAPT: Document where the log/PID files are stored (e.g., .local-data/).
     Mention any project-specific URLs to open after starting. -->

Logs and PID files are stored in `.local-data/logs/` and `.local-data/` (per-worktree).

The script detects port conflicts: it will refuse to start if a dev server is already running.

**Two-tier shutdown:** `dev:down` only kills dev server processes — it intentionally leaves infrastructure (Docker containers, databases) running so restarts are fast. Full infrastructure cleanup happens via `setup-worktree --remove` when tearing down the worktree entirely.

### Start the dev server in a specific worktree

```sh
git worktree list                    # 1. find the worktree directory
cd <worktree-dir> && npm run dev:up  # 2. start the dev server
# 3. read the log file (path printed on start) to confirm startup and find URLs
npm run dev:down                     # 4. stop when done (same directory)
```

## Directory Layout

<!-- ADAPT: List your shared and per-worktree directories. -->

- **`.local/`** — Shared across worktrees (symlinked). Lightweight files: personal notes, `worktree-slots.json`.
- **`.local-data/`** — Per-worktree. Runtime data: databases, caches, PID files, `logs/` (dev server logs).
