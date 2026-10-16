---
id: "7f806f13-61b0-43f3-b1de-76ec01ced276"
type: "scenario"
label: "Hooks save the base"
given: "a git repository with a model folder and a post-commit hook of its own"
tests: "apps/cli/src/hooks.test.ts › radical hooks"
then: "post-checkout, post-commit and post-merge each hold the line once, the existing hook still runs, the hooks are executable, and the commit leaves a fresh .radical/base.json"
when: "radical hooks install runs twice, and a commit is made"
---
