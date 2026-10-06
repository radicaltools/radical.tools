---
id: "9cfa0c62-057a-48c9-95d0-e57beef55249"
type: "requirement"
label: "Propagate a past edit"
action: "Studio shall apply the element, relation and sequence differences to the active milestone, every later milestone and the live model."
ears_type: "event-driven"
rationale: "A fix made in an old version usually belongs in every version after it. Evidence: packages/ui/src/store/diagramStore.ts:3346-3494; apps/studio/src/renderer/src/components/MilestoneEditOverlay.tsx:37-43; packages/ui/tests/milestones.test.ts:289-336; manual#milestones"
trigger: "the user chooses Propagate for edits made on a milestone"
---
