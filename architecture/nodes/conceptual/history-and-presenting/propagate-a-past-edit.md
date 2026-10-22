---
id: "9cfa0c62-057a-48c9-95d0-e57beef55249"
type: "requirement"
label: "Propagate a past edit"
action: "Studio shall apply the element, relation and sequence differences of the milestone open in Designer, also while a presentation plays (which it ends first), to the active milestone, every later milestone and the live model; for a sequence, the fields that changed and the steps and notes added, removed or changed, applied to the steps each later model has; an element moved into a parent a later model lacks stays where it is in that model."
ears_type: "event-driven"
rationale: "A fix made in an old version usually belongs in every version after it. Pressed while a presentation played, it diffed the playing slide's model and wrote it into later milestones and the live model (round 170–175, 2026-10-22, F-0022). Evidence: packages/ui/src/store/diagramStore.ts (commitMilestoneChanges, discardMilestoneChanges, startPresentation); apps/studio/src/renderer/src/components/MilestoneEditOverlay.tsx; packages/ui/tests/milestones.test.ts, packages/ui/tests/milestonePresenting.test.ts; manual#milestones"
trigger: "the user chooses Propagate for edits made on a milestone"
---
