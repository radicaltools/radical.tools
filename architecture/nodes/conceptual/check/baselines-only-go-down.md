---
id: "01635a8a-9c61-4e42-b1c9-5a3882914c15"
type: "requirement"
label: "Baselines only go down"
action: "lower each rule's baseline (max) in the config to the count found now, never raise it, and leave the baseline of a rule that did not run (the test rules without a test report, every model rule on a folder that is no model), which the output marks not run"
ears_type: "event-driven"
rationale: "An existing model adopts the gate without fixing every gap first, and each pull request can only shrink the debt. Evidence: ratchetConfig in packages/common/src/check/index.ts"
trigger: "`radical check` runs with --ratchet"
---
