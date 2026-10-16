---
id: "7f806f13-61b0-43f3-b1de-76ec01ced276"
type: "scenario"
label: "Hooks save the base"
given: "a git repository with a model folder and a post-commit hook of its own"
tests: "apps/cli/src/hooks.test.ts › radical hooks"
then: "post-checkout, post-commit and post-merge each hold the line once with the folder's path, the existing hook keeps its command, the hooks are executable, the install from the moved CLI updates the line in place, and the commit runs both; outside git and for another action the command exits 2"
when: "radical hooks install runs twice, then from a CLI that moved, and a commit is made"
---
