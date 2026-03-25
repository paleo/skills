---
title: Local Environment Management for Agents
summary: Agent procedures for creating/removing worktrees, starting/stopping the dev server.
read_when:
  - setting up or removing a worktree
  - starting or stopping the dev server
---

# Local Environment Management for Agents

## Worktree / Local Environment Setup

When the user asks to "set up a new worktree":

### Find or create a branch

The user must be clear if they want you to create a new branch or reuse an existing one. If it's unclear, ask for clarification.

If you have to create a new branch: we don't want to overwrite an existing branch. Check the list of existing branches before creating a new one. If a branch with the same name already exists locally, append a numeric suffix starting at 2 (e.g., `fix/123-2`).

### Worktree directory

Create the worktree, and run the setup script:

```sh
git worktree add ../REPONAME-fix-123 fix/123
cd ../REPONAME-fix-123
npm run setup-worktree -- --quiet
```

<!-- ADAPT: Replace REPONAME with your repository name. Update the setup
     command if your project uses a different task runner. Document any
     project-specific ports or URLs the developer should know about. -->

The setup script handles dependency installation, build, config generation, and database provisioning.

### Removing a worktree

When the user asks to "delete the worktree" for a branch (e.g., `fix/123`):

1. Locate the worktree directory using `git worktree list` and find the entry matching the branch name. If there are multiple matches (e.g., `fix/123`, `fix/123-2`), **ask the user** to select which one to delete. **DO NOT PROCEED** if there is ambiguity.
2. Verify the branch has been removed from the remote (`git fetch && git branch -r` should NOT list it). If it still exists on the remote, **warn the user** and do NOT proceed unless they explicitly confirm.
3. Free the worktree slot and remove the worktree:

   ```sh
   cd <worktree-directory>
   npm run setup-worktree -- --free
   cd -
   git worktree remove <worktree-directory>
   ```

Be cautious. **NEVER** delete a branch unless the user explicitly requests it.

## Dev Server

Use `npm run dev:agent`. It runs the dev server in the background with logs redirected to a file, then returns once the server is ready.

```sh
npm run dev:agent        # Start in background
npm run dev:agent:stop   # Stop the background server
```

<!-- ADAPT: Document where the log/PID files are stored (e.g., .local-data/).
     Mention any project-specific URLs to open after starting. -->

The script detects port conflicts, so it will refuse to start if a dev server is already running.

### Start the dev server in a specific worktree

1. Find the worktree directory: `git worktree list`
2. Run `npm run dev:agent` from the worktree directory
3. Read the log file (path printed on start) to confirm the server started and find the URLs
4. When done, run `npm run dev:agent:stop` from the same directory

## Directory Layout

<!-- ADAPT: List your shared and per-worktree directories. -->

- **`.local/`** — Shared across worktrees (symlinked). Lightweight files: personal notes, `worktree-slots.json`.
- **`.local-data/`** — Per-worktree. Runtime data: databases, caches, logs.
