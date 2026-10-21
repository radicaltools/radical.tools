---
id: "7f806f13-61b0-43f3-b1de-76ec01ced276"
type: "scenario"
label: "Hooks save the base"
given: "a git repository with a model folder and a post-commit hook of its own"
tests: "apps/cli/src/hooks.test.ts › radical hooks"
then: "post-checkout, post-commit, post-merge and post-rewrite each hold the line once with the folder's path, right after #!, the existing hook keeps its command, the hooks are executable, the install from the moved CLI updates the line in place, a second folder adds its own line, a Python hook is left alone with exit 2, a line an earlier version put after exit is moved to where it runs, and the commit runs both; the line runs the CLI of the working tree the hook runs in and says when it is not there; outside git and for another action the command exits 2"
when: "radical hooks install runs twice, then from a CLI that moved, then for a second folder and on a repository with a Python hook and a hook ending in exit, and a commit is made"
---
