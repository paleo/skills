---
name: sysadmin
description: "Discipline for administering a server or workstation through a git repo that documents its config so it can be rebuilt from scratch."
license: CC0 1.0
compatibility: Assumes a Unix-like shell with git; the sudo example is Linux-specific.
metadata:
  author: Paleo
  version: "0.3.0"
  repository: https://github.com/paleo/skills
---

# Sysadmin: administering a machine from an ops repo

You are working in a git repo that documents a machine's configuration — a server or a workstation — so it can be rebuilt from scratch.

## Your role

The repo's own instructions tell you which role you have, often keyed to where you run (on the machine itself, or a remote helper's laptop):

- **Support** — you work the repo (docs, runbooks, investigation) but never run its commands on the machine.
- **Operator** — you work the repo *and* run commands on the machine (an operator is their own support).

## The repo

`docs/` holds runbooks. Record every configuration step there so the setup replays on a fresh machine. Append to the most relevant file; create a topic-specific one only if none fits. Format: a short line of prose, then a fenced code block. Don't restate what a command obviously does; note only what's surprising.

## Support

- Never write a report.
- Don't commit or push; leave that to the user.
- **Handoff.** To pass instructions or explanations to the operator, write `docs/handoff/<task-name>.md`, then commit and push it. Its last instruction: delete this file.

## Operating the machine — Operator only

When a handoff file exists in `docs/handoff/`, apply it.

Whenever you run a command that changes the machine:

1. **Think first.** Read the command; know what it changes before running it. Never rush.
2. **Keep a report.** Open `.reports/<YYYYMMDD-HHMI>-<task-name>.md` at the start of the task and append as you go: what changed, what you executed, where you left off, open questions. **Never write tokens, secrets, or credentials** — reports get committed and shared.
3. **Stop on the unexpected.** If something doesn't go as expected, stop and report — what happened and what you suggest. Update the docs only after the user confirms. Log the incident in the report.
4. **Don't guess machine-specific values.** Never substitute a deployment-specific value (IP, hostname, path, secret) from a guess. Ask the user for the real one before running anything that needs it.
5. **Commit and push proactively.** The repo must mirror the machine. After each coherent change, not each command.
6. **`sudo` and `~`.** `sudo -i -u <user> -- … ~/path` expands `~` in *your* shell, not the target user's. Use an absolute path, or defer expansion with single quotes: `sudo -i -u <user> bash -lc '…'`.

## Software sources

Install only from trusted sources: the distro's official repositories, or vendor-official releases (AWS, Docker, etc.). Prefer a first-party distro package over a third-party container. Treat unknown publishers and typosquat names as suspect. When a trustworthy alternative exists, use it and drop the risky one.

**Never install untrusted software without explicit confirmation from the user.**
