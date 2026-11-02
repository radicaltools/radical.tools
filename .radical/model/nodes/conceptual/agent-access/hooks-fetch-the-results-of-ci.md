---
id: "911195ec-f656-47c8-990f-d7b1870b55b2"
type: "requirement"
label: "Hooks fetch the results of CI"
action: "the hook shall, after saving the base, run radical check --from-ci --quiet --detach for the model folder as a command of its own, its input and output closed, which starts the check in the background and returns at once, so it neither delays nor fails the git command, a CLI built before --from-ci still saves the base, and one fetch at a time runs for the folder"
ears_type: "event-driven"
rationale: "Nobody remembers to fetch results; after a checkout, a commit, a pull or a rebase the commit HEAD stands on changes, and with it the nearest results of CI. The hooks are one set for every worktree, so a worktree's older CLI must not lose the base over an option it does not know. Evidence: apps/cli/src/hooks.ts, apps/cli/src/check.ts (--detach), apps/cli/src/index.ts (Io.background), apps/cli/src/ciResults.ts (withFetchLock)"
trigger: "a git hook that radical hooks install wrote runs"
---
