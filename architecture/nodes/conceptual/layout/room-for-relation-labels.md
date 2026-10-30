---
id: "0317b5ce-8856-47b2-bfb8-6356f24f893d"
type: "scenario"
label: "Room for relation labels"
given: "siblings and roots joined by labelled and unlabelled relations"
metrics: |
  test(packages/layout/tests/labelRoom.test.ts › labelGaps) passed
  test(packages/layout/tests/labelRoom.test.ts › finalizeLayout with label gaps) passed
  test(packages/layout/tests/labelRoom.test.ts › Smart Layout) passed
then: "pairs joined by a labelled relation, or their sibling ancestors, are kept apart by the label's room, others by the base gap, unlabelled relations and relations into an ancestor need none, and the label crowding score is zero"
when: "Smart Layout finalises a layout"
---
