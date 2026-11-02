---
id: "85186a31-42f5-4fd5-b324-92fe77f14f57"
type: "scenario"
label: "Ratchet skips rules not run"
given: "a check.json with test-not-found at max 2"
then: "the test rules and the goals on what tests verify (and on a folder that is no model every model rule, stale-reference too) are marked not run, and their baselines stay as they were; the Inspector counts stale references as the check does, shows — for the rules on the folder's files, and its Ratchet leaves their baselines"
when: "radical check --ratchet runs without --report, or on a folder that is no model; and the Inspector's Settings show a folder model"
---
