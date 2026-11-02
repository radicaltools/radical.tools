---
id: "34095b8c-bfbf-4222-9115-3e9235e495da"
type: "requirement"
label: "Save edit as new milestone"
action: "Studio shall insert a new milestone holding the edited state right after the active one and leave later milestones unchanged."
ears_type: "event-driven"
rationale: "Sometimes a past edit is an alternative version, not a correction, and must not rewrite history. Evidence: packages/ui/src/store/diagramStore.ts:3364-3389; apps/studio/src/renderer/src/components/MilestoneEditOverlay.tsx:44-57; packages/ui/tests/milestones.test.ts:280-287; manual#milestones"
trigger: "the user chooses Save as new milestone for edits made on a milestone"
---
