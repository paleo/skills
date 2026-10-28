# Paleo's Skills

My personal collection of agent skills.

## paroicms-website

Guidelines for working on a ParoiCMS website directory (themes, templates, configuration).

```sh
npx skills add https://github.com/paleo/skills --skill paroicms-website
```

## pleasant-bem-css

Pleasant BEM syntax and methodology for writing CSS class names.

```sh
npx skills add https://github.com/paleo/skills --skill pleasant-bem-css
```

## sharp-testing

Rules for writing valuable automated tests without accumulating redundant or implementation-coupled checks.

```sh
npx skills add https://github.com/paleo/skills --skill sharp-testing
```

## sharp-writing

Conventions for writing sharp, concise prose and Markdown, for humans and AI agents.

```sh
npx skills add https://github.com/paleo/skills --skill sharp-writing
```

## sysadmin

Discipline for administering a machine from a git repo that documents its configuration: `docs/` runbooks, a `.reports/` journal, and running commands safely.

```sh
npx skills add https://github.com/paleo/skills --skill sysadmin
```

### In your `AGENTS.md` or `CLAUDE.md` file

```md
## Sysadmin workflow

Follow the `sysadmin` skill: record steps as runbooks under `docs/`, keep a per-task `.reports/` journal, and run commands carefully.

Two agents work on this repo — your role depends on which you are:

- **Laptop**: **support** — edits docs, never executes on the server.
- **VPS** (`~/<path-to-admin-repository>` on `<hostname>`, as `<user>`): **operator** — edits docs *and* executes.
```

Replace the placeholders with values specific to the machine (the server) you run commands on:

- `<path-to-admin-repository>`: the path to the repository;
- `<hostname>`: the VPS hostname;
- `<user>`: the Linux user you log in as on the server.

## top-down-typescript

TypeScript and JavaScript coding style conventions, built around top-down narrative ordering and functions over classes.

```sh
npx skills add https://github.com/paleo/skills --skill top-down-typescript
```

## Working on this repository

After a fresh clone:

```sh
npm install
mkdir .plans
npx -y alignfirst workspace setup
```

To use an existing team plans clone, replace `mkdir .plans` with `npx -y alignfirst plans setup <plans-clone-path>`. The configured folder is `skills/`; preserve existing plans and their location.

Setup shares `.plans` and `.local`, then installs dependencies. There is no build, test suite or dev server. See `DEVELOPERS.md` and `npx -y alignfirst workspace --guide`.

The CLI is fetched on demand. `npm install -g alignfirst` is an optional convenience.

## License

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
