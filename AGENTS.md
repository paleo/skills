# Repository Guidelines

**Important:** Every text in this repository must be sharp, concise, straight to the point. Each word must be carefully weighted and chosen.

Always ignore the `.local`, `.local-wt` and `.plans` directories when searching the codebase.

## Start every session with the project context

Run `npx -y alignfirst context` from the repository root as your first command, whatever the task. It prints the project conventions (ticket IDs, branch names, commits), the documentation map, and the AlignFirst protocols.

### Essential Documentation

Always read before any investigation or work:

- `docs/authoring-skills.md` — skill structure, frontmatter, and the release steps

## Workspaces

Workspace setup shares `.plans` and `.local`, then runs `npm install`. This repository has no build, test suite or dev server; setup prepares the tooling only.

Run `npx -y alignfirst workspace --guide` for the procedures.

## Workflow

Work directly on `main`; this repository does not branch per ticket. Increment ticket IDs from the highest existing directory in `.plans/`; ask the user when unsure. Omit ticket IDs from commit messages.

### Team Plans Repository

In the main worktree, `.plans` is a symlink into a clone of the team plans repository (folder `skills/`). Plans are shared with the team through that repository and are never committed in this one.

After every change in `.plans/`, run `npx -y alignfirst sync`.
