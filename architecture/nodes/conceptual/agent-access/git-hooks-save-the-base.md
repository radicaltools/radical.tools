---
id: "8b04c5bd-5e7a-46ad-bc42-7563e225585e"
type: "requirement"
label: "Git hooks save the base"
action: "the CLI shall add to the repository's post-checkout, post-commit, post-merge and post-rewrite hooks a line that saves that folder's base, keep what the hooks already hold, add nothing a second time, bring an installed line up to date when the CLI or node moved, and make the hooks executable"
ears_type: "event-driven"
rationale: "With the model edited first in Studio, nothing else saves the base when a branch is started; the hooks keep it right after a checkout, a commit (amended too), a pull or a merge, and a rebase (post-rewrite), without anyone thinking of it. A fetch, a reset or a stash runs no hook: radical diff --save-base saves it then. The line runs the very CLI that installed it, with the node on the PATH, and never fails the git command. Evidence: apps/cli/src/hooks.ts (HOOK_NAMES), apps/cli/src/index.ts (Io.command), apps/web/manual.html (When the base is saved)"
trigger: "radical hooks install runs for a model folder in a git repository"
---
