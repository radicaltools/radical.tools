---
id: "f8a517f5-d99f-41c0-bde9-8a1859637804"
type: "requirement"
label: "Create a milestone"
action: "Studio shall store a named, timestamped milestone holding all elements, relations and sequences of the current model, the elements where All elements has them, whichever view is open."
ears_type: "event-driven"
rationale: "A frozen, named snapshot is what later comparisons and time travel are built on. With a view open the elements hold its layout, and a milestone made then kept that view's positions as its All elements (2026-10-14). Evidence: packages/ui/src/store/diagramStore.ts (createSnapshot); packages/ui/src/components/RightPanel.tsx; packages/ui/tests/milestones.test.ts, packages/ui/tests/milestoneViewPositions.test.ts; manual#milestones"
trigger: "the user enters a name after clicking + New milestone"
---
