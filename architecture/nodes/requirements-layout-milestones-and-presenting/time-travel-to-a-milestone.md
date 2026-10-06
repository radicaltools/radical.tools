---
id: "912de6dd-0fe6-47e0-9279-060dae3778e0"
type: "requirement"
label: "Time travel to a milestone"
action: "Studio shall show the model as it was at that milestone in every view, keep the live model aside, and name the milestone in a chip at the top of the canvas."
ears_type: "event-driven"
rationale: "Looking at a past state must work like looking at the current one, without touching current work. Evidence: packages/ui/src/store/diagramStore.ts:3208-3317; packages/ui/src/components/Canvas.tsx:849-872; packages/ui/src/components/RightPanel.tsx:563-600; packages/ui/tests/milestones.test.ts:73-107; manual#milestones"
trigger: "the user clicks a milestone in the Milestones list"
---
