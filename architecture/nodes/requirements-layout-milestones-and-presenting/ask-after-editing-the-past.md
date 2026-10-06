---
id: "507059e8-d072-4a42-9413-bd1c49eac641"
type: "requirement"
label: "Ask after editing the past"
action: "Studio shall ask whether to propagate the change to later milestones, save it as a new milestone, or discard it."
ears_type: "event-driven"
rationale: "An edit to a past state is ambiguous, so the user decides what it means instead of the tool guessing. Evidence: packages/ui/src/store/diagramStore.ts:1448-1462; apps/studio/src/renderer/src/components/MilestoneEditOverlay.tsx:1-74; packages/ui/src/components/Canvas.tsx:889-930; packages/ui/tests/milestones.test.ts:338-417; manual#milestones"
trigger: "the user first changes the model while a milestone is shown in the Designer perspective"
---
