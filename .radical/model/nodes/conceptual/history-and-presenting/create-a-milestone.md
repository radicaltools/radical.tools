---
id: "f8a517f5-d99f-41c0-bde9-8a1859637804"
type: "requirement"
label: "Create a milestone"
action: "Studio shall store a named, timestamped milestone after the last one, holding all elements, relations and sequences of the live model, also while an older milestone is shown, the elements where the live All elements has them, whichever view is open."
ears_type: "event-driven"
rationale: "A frozen, named snapshot is what later comparisons and time travel are built on. With a view open the elements hold its layout, and a milestone made then kept that view's positions as its All elements (2026-10-14). With an older milestone shown it saved that milestone again as the newest; the maintainer decided on 2026-10-22 (F-0024, round 170–175) that it always captures the live model. Evidence: packages/ui/src/store/diagramStore.ts (createSnapshot, liveBackup); packages/ui/src/components/RightPanel.tsx; packages/ui/tests/milestones.test.ts, packages/ui/tests/milestoneViewPositions.test.ts, packages/ui/tests/newMilestone.test.ts; manual#milestones"
trigger: "the user enters a name after clicking + New milestone"
---
