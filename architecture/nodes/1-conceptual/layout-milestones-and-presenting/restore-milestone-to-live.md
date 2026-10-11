---
id: "6ab7f200-95d0-45c6-b482-113389c1a739"
type: "requirement"
label: "Restore milestone to live"
action: "Studio shall replace the current elements, relations and sequences with that milestone's content as one undoable step."
ears_type: "event-driven"
rationale: "Rolling back to a known-good state is one of the promised milestone operations. Evidence: packages/ui/src/store/diagramStore.ts:3155-3171; packages/ui/src/components/RightPanel.tsx:1022-1030; packages/ui/tests/milestones.test.ts:156-167; landing (Milestones: restore)"
trigger: "the user clicks Restore to live in a milestone's properties"
---
