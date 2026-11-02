---
id: "350c1117-6506-458b-b5c4-4f75d12b3f82"
type: "scenario"
label: "Settings saved to check.json"
given: "a folder model with a check report and a check.json that allows three requirements without a scenario, open in the Inspector's Settings"
metrics: |
  test(apps/e2e/tests/studio/inspector.spec.ts › Settings save goals and rules to check.json, and say when a change loosens the gate) passed
  test(apps/studio/tests/inspectorSettings.test.ts) passed
then: "the raised baseline is marked as loosening the CI gate in its row and in the save bar, Ratchet brings it down to what the check finds, the diff shows the goals, and check.json holds exactly the lowered baseline and the two goals, whose tabs count them as met"
when: "the user raises that baseline, discards it, presses Ratchet, sets two goals and saves"
---
