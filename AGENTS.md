# Repository Guidelines

**Important:** Every text in this repository must be sharp, concise, straight to the point. Each word must be carefully weighted and chosen.

Always ignore the `.local`, `.local-wt` and `.plans` directories when searching the codebase.

## Docmap - Seek Documentation

*Before* any investigation or code exploration, run `npm run docmap`, then read the relevant documentation. Mandatory for every task.

### Essential Documentation

Always read before any investigation or work:

- `docs/authoring-skills.md` — skill structure, frontmatter, and the release steps

## Workspaces

A **workspace** is a git worktree (with its branch) plus its own dev setup: symlinked shared directories and seeded config files. Workspaces are isolated, so you can work on several branches in parallel. This repository has no dev server, so the system runs portless: nothing to start, no `dev` script.

Run `npm run workspace -- --guide` for the full procedures.

## AlignFirst - Ticket ID, Commit Message, Default Branch

_Ticket ID:_ Format is numeric (`1`, `2`, …), incremented from the highest existing directory in `.plans/`. This repo doesn't branch per ticket, so ask the user when unsure.

_Commit message convention:_ conventional commits, e.g. `feat: improve the sysadmin skill`. Do not mention the ticket ID.

_Default branch:_ `main`

### Team Plans Repository

In the main worktree, `.plans` is a symlink into a clone of the team plans repository (folder `skills/`). Plans are shared with the team through that repository and are never committed in this one.

After every change in `.plans/`, synchronize the plans: `npm run plans:sync`.
