---
id: "1d66d5e0-77d1-4171-b3f8-c04e137e9691"
type: "scenario"
label: "Hooks fetch in the background"
given: "a git repository with a model folder"
metrics: "test(apps/cli/src/hooks.test.ts › radical hooks › the line fetches the results of CI in the background) passed"
then: "each hook's line saves the base and then runs radical check --from-ci --quiet --detach for the folder as a command of its own, its input and output closed; --detach starts the check in the background without --detach and exits 0, and says so with exit 2 when nothing can start it; a line an earlier version installed is brought up to date in place"
when: "radical hooks install runs and the hooks are read"
---
