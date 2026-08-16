// Workspace lifecycle wrapper. This repository holds agent skills — no build and
// no dev server — so the system runs portless: no ports, no `dev` script.

import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runWorkspace } from "@paleo/workspace";

await runWorkspace({
  workspaceScript: fileURLToPath(import.meta.url),

  sharedDirs: [".local", ".plans"],
  runtimeDir: ".local-wt",

  gitignoredFiles: [],

  preSetup: ({ isMainWorktree, currentWorktree }) => {
    if (!isMainWorktree) return;
    // `.plans` must be usable: a symlink into the team plans repository clone, or a
    // plain local directory (an external contributor without access to the clone).
    // Only a missing or broken `.plans` fails setup. `--no` keeps npx from installing
    // anything: the bin is `plans-share`, but the package is `@paleo/plans-share`, so a
    // bare npx would look up an unrelated public name.
    execFileSync("npx", ["--no", "plans-share", "check"], {
      cwd: currentWorktree,
      stdio: "inherit",
    });
  },

  finalizeWorkspace: ({ currentWorktree, progress }) => {
    progress("npm install");
    execSync("npm install", { stdio: "inherit", cwd: currentWorktree });
  },

  formatSummary: ({ name, branch, currentWorktree, isMainWorktree, status }) => `
Workspace ${name} — ${status}
  Type:   ${isMainWorktree ? "main" : "linked"}
  Branch: ${branch}
  Path:   ${currentWorktree}
`,
});
