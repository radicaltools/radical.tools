---
id: "ad51f9e6-e36b-4e62-b862-6ddc50407970"
type: "requirement"
label: "Manual review recorded"
action: "the CLI shall add the result, who, when and the note to reviews.json in the model folder, kept in git, and radical check shall evaluate a `review(<name>) passed` condition against the latest review of that name, stale after max_age."
ears_type: "event-driven"
rationale: "A manual fitness function is a review a person makes; recorded in git it reaches CI with the pull request that records it (the user's decision, 2026-10-30). Evidence: apps/cli/src/sense.ts (reviewCommand), packages/common/src/check/reviews.ts, apps/cli/src/check.ts, apps/studio/src/renderer/src/persistence/inspector.ts (inspectorMeasurements), packages/node-files/src/selectionFile.ts"
trigger: "a person runs `radical sense review <name> --passed` (or --failed) `--by <who>`"
---
