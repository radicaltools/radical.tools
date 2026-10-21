---
id: "85186a31-42f5-4fd5-b324-92fe77f14f57"
type: "scenario"
label: "Ratchet skips rules not run"
given: "a check.json with test-not-found at max 2"
tests: |
  packages/common/tests/checkReports.test.ts › radical check with test reports › leaves the baselines of the rules that read reports as they are when none was given
  packages/common/tests/check.test.ts › radical check: config › ratchets no baseline of a rule that did not run on a folder that is no model
  packages/common/tests/check.test.ts › radical check: config › ratchets no stale-reference baseline on a folder that is no model
  packages/common/tests/check.test.ts › radical check: config › counts no folder rule on a model in memory, so neither Ratchet lowers its baseline
  apps/cli/src/cli.test.ts › radical check › says that a goal on what the tests verify did not run without a report
  apps/e2e/tests/studio/inspector.spec.ts › Settings count stale references as the check does, and leave the rules on the folder's files to radical check
then: "the test rules and the goals on what tests verify (and on a folder that is no model every model rule, stale-reference too) are marked not run, and their baselines stay as they were; the Inspector counts stale references as the check does, shows — for the rules on the folder's files, and its Ratchet leaves their baselines"
when: "radical check --ratchet runs without --report, or on a folder that is no model; and the Inspector's Settings show a folder model"
---
