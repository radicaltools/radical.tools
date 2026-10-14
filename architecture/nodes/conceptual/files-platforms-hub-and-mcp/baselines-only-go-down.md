---
id: "01635a8a-9c61-4e42-b1c9-5a3882914c15"
type: "requirement"
label: "Baselines only go down"
action: "lower each rule's baseline (max) in the config to the count found now, and never raise it"
ears_type: "event-driven"
rationale: "An existing model adopts the gate without fixing every gap first, and each pull request can only shrink the debt. Evidence: ratchetConfig in packages/common/src/check/index.ts"
trigger: "`radical check` runs with --ratchet"
---
