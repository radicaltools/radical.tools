---
id: "85186a31-42f5-4fd5-b324-92fe77f14f57"
type: "scenario"
label: "Ratchet skips rules not run"
given: "a check.json with test-not-found at max 2"
tests: |
  packages/common/tests/checkReports.test.ts › radical check with test reports › leaves the baselines of the rules that read reports as they are when none was given
  packages/common/tests/check.test.ts › radical check: config › ratchets no baseline of a rule that did not run on a folder that is no model
then: "the test rules (and on a folder that is no model every model rule) are marked not run, and their baselines stay as they were"
when: "radical check --ratchet runs without --report, or on a folder that is no model"
---
