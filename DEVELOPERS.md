# Developer Guide

This repository is a collection of agent skills under `skills/`, published on GitHub and installed by consumers with `npx skills add`. There is no application code, no build, and no test suite. See `docs/authoring-skills.md` for how a skill is structured and released.

## Branches and workspaces

Work happens directly on `main`: this repo doesn't branch per ticket, and commits are pushed as they land.

In the rare case a branch is needed, create a workspace — a git worktree plus its setup: `.plans` and `.local` symlinked to the main worktree, then `npm install`. There is no dev server, so the tooling runs portless: nothing to start, no `dev` script.

Run `npm run workspace -- --guide` to learn the full procedures.

## Conventions

- _Ticket ID_: numeric, incremented from the highest existing directory in `.plans/`. Ask the user when unsure.
- _Commit messages_: conventional commits, e.g. `feat: improve the sysadmin skill`. Do not mention the ticket ID.
- _Default branch_: `main`.

## Everyday commands

| Command | Purpose |
|---------|---------|
| `npm run docmap` | Browse the documentation |
| `npm run workspace -- <command>` | Manage worktree workspaces (`--guide` for the procedures) |
| `npm run plans:sync` | Publish and retrieve the task plans (`.plans`) |
