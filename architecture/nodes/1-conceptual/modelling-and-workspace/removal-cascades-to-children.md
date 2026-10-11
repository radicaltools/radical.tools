---
id: "87cfffd7-06c9-4c36-9cdb-03bdfff5b04e"
type: "requirement"
label: "Removal cascades to children"
action: "the system shall also remove its descendants, every relation touching any of them and every view reference to them."
ears_type: "event-driven"
rationale: "Leaving orphan children or dangling relations would corrupt the model. Evidence: packages/common/src/model.ts:192-208; packages/ui/src/store/diagramStore.ts:1633-1640; packages/ui/tests/model.test.ts:131,142,149; manual#selection"
trigger: "an element is removed from the model"
---
