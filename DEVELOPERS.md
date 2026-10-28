# Developer Guide

This repository is a collection of agent skills under `skills/`, published on GitHub and installed by consumers with `npx skills add`. There is no application code, no build, and no test suite. See `docs/authoring-skills.md` for how a skill is structured and released.

## Branches and workspaces

Work happens directly on `main`: this repo doesn't branch per ticket, and commits are pushed as they land.

For a branch, use an AlignFirst workspace. Setup shares `.plans` and `.local`, then runs `npm install`. This prepares the tooling only; there is no build or dev server.

Run `npx -y alignfirst workspace --guide` for the procedures. Project-local `.plans` and `.local-wt` must be ignored and untracked before setup.

## Conventions

`alignfirst.json` records the ticket pattern, commit style and default branch. Increment ticket IDs from the highest existing directory in `.plans/`; ask the user when unsure. Omit ticket IDs from commit messages.

The main `.plans` symlink selects the `skills/` folder in the separate team plans repository. Preserve that location and history. After changing plans, run `npx -y alignfirst sync`.

## Everyday commands

| Command | Purpose |
|---------|---------|
| `npx -y alignfirst context` | Load conventions, documentation map and protocols |
| `npm run docmap` | Browse the documentation |
| `npx -y alignfirst docmap --check` | Validate the documentation |
| `npx -y alignfirst workspace <command>` | Manage workspaces |
| `npx -y alignfirst sync` | Publish and retrieve task plans (`.plans`) |
