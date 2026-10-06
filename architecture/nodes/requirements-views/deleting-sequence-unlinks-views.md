---
id: "1f0281a3-3472-4c3d-b1cb-c9ec4f0e2473"
type: "requirement"
label: "Deleting sequence unlinks views"
action: "The system shall unlink every Flow view that showed it and keep those views."
ears_type: "event-driven"
rationale: "Views must not point to a sequence that no longer exists. Evidence: packages/ui/src/store/diagramStore.ts:2478-2491; packages/common/src/model.ts:303-309; packages/ui/tests/sequences.test.ts:92-101; manual#view-flow"
trigger: "the user deletes a sequence"
---
