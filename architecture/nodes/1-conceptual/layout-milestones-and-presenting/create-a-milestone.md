---
id: "f8a517f5-d99f-41c0-bde9-8a1859637804"
type: "requirement"
label: "Create a milestone"
action: "Studio shall store a named, timestamped milestone holding all elements, relations and sequences of the current model."
ears_type: "event-driven"
rationale: "A frozen, named snapshot is what later comparisons and time travel are built on. Evidence: packages/ui/src/store/diagramStore.ts:3139-3153; packages/ui/src/components/RightPanel.tsx:520-560; packages/ui/tests/milestones.test.ts:56-71, packages/ui/tests/milestones.test.ts:213-223; manual#milestones"
trigger: "the user enters a name after clicking + New milestone"
---
