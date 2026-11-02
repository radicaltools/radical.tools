---
id: "b6b830fc-97d4-43bd-af02-260aea0bd9cb"
type: "scenario"
label: "Relaxed winner competes"
given: "a small diagram piled on top of itself"
metrics: |
  test(packages/layout/tests/smartLayout.test.ts › runSmartLayoutCore guarantees › scores what the live physics makes of its winner, and keeps the better of the two) passed
  test(packages/layout/tests/liveColaRest.test.ts › relaxLayout › does not take on a diagram too large to relax) passed
then: "its candidates include one relaxed form of the winner, the returned winner scores no worse than it, and a diagram above the relaxation size limit is not relaxed"
when: "Smart Layout runs"
---
