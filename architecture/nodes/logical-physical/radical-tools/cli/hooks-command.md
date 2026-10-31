---
id: "0f2bd2dc-9024-4a47-ab42-8acb021a3591"
type: "component"
label: "Hooks command"
technology: "Node.js"
---

apps/cli/src/hooks.ts (radical hooks install [folder]). Finds the repository's hooks directory with git rev-parse --git-path hooks, and adds to post-checkout, post-commit, post-merge and post-rewrite one marked line that runs radical diff --save-base for the folder and then, as a command of its own with its output closed, radical check --from-ci --quiet --detach, which fetches the test results of CI in the background; it keeps each hook's own content, never twice, brings the line up to date when the CLI or node moved, and makes the hooks executable. This repository installs them for its own architecture/ with npm run hooks (once after cloning, and again after the CLI moves), so Studio's Changes on branch always has the base of the branch checked out and the Inspector the results of CI. Run through radical.sh (RADICAL_LAUNCHER) in the repository, the line runs sh radical.sh, as npx may be on no PATH.
