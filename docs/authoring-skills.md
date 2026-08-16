---
title: Authoring Skills
read_when:
  - adding a new skill to this repository
  - editing an existing skill
  - releasing a skill change
---

# Authoring Skills

Each skill is a directory under `skills/`, installable with `npx skills add https://github.com/paleo/skills --skill <name>`.

## Structure

- `skills/<name>/SKILL.md` — the skill itself. Required.
- `skills/<name>/references/` — optional companion files loaded on demand by the skill (Markdown, `.d.ts` type definitions, …).

`SKILL.md` starts with a YAML frontmatter:

```yaml
---
name: <name>            # matches the directory name
description: "One or two sentences: what the skill covers, and when to read it."
license: CC0 1.0
compatibility: <optional environment assumptions>
metadata:
  author: Paleo
  version: "0.1.0"      # semver, bumped on every change
  repository: https://github.com/paleo/skills
---
```

## Writing rules

Apply the `sharp-writing` skill to every text. The `description` is what agents match against to decide whether to load the skill: state the subject and the trigger ("Read before…").

## Releasing a change

1. Bump `metadata.version` in the skill's frontmatter.
2. Update the skill's entry in `README.md` when its description changed.
3. Commit on `main` (conventional commits, no ticket ID) and push: consumers reinstall with `npx skills add`.
