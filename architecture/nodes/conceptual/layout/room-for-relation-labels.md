---
id: "0317b5ce-8856-47b2-bfb8-6356f24f893d"
type: "scenario"
label: "Room for relation labels"
given: "siblings and roots joined by labelled and unlabelled relations"
tests: |
  packages/layout/tests/labelRoom.test.ts › labelGaps
  packages/layout/tests/labelRoom.test.ts › finalizeLayout with label gaps
  packages/layout/tests/labelRoom.test.ts › Smart Layout
then: "pairs joined by a labelled relation, or their sibling ancestors, are kept apart by the label's room, others by the base gap, unlabelled relations and relations into an ancestor need none, and the label crowding score is zero"
when: "Smart Layout finalises a layout"
---
