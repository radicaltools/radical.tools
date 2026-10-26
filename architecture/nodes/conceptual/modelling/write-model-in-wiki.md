---
id: "f5c5a8ff-617b-48ff-b6d3-82085684ae5c"
type: "requirement"
label: "Write model in wiki"
action: "add an element of the line's type for each line in the order written, read a requirement line as an EARS sentence into its fields and name it after its action, keep the focus on the emptied line, show a pasted list before adding it as one undo step, and offer on an empty page where to start by the palette's categories; a line whose link the model refuses is not added, and says why, never added unlinked"
ears_type: "event-driven"
rationale: "A model is written down from its Overview without a wizard or a change of page. A line whose link the rules refused was added without it (F-0100, round 193–200, 2026-10-26). Evidence: apps/e2e/tests/studio/wiki.spec.ts; packages/ui/src/store/diagramStore.ts (addNodes)"
trigger: "the user writes a line in a wiki page's writing line and presses Enter, or pastes a list into it"
---
