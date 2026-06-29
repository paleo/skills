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

Replace `<path-to-admin-repository>` with the path to the repository on machine (the server) you run commands, `<hostname>` with the VPS hostname. The `<user>` is the Linux user you log in on the server.

## top-down-typescript

TypeScript and JavaScript coding style conventions, built around top-down narrative ordering and functions over classes.

```sh
npx skills add https://github.com/paleo/skills --skill top-down-typescript
```

## License

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
