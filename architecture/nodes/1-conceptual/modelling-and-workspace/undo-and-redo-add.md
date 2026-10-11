---
id: "51af54db-6541-4a73-bbec-0aeb9893e78d"
type: "scenario"
label: "Undo and redo add"
gherkin: "# Covered by: apps/e2e/tests/studio/editing.spec.ts › undo and redo"
given: "the user has just added a Software System from the palette"
then: "the element disappears after undo and comes back after redo"
when: "the user presses ⌘/Ctrl+Z and then ⌘/Ctrl+Shift+Z"
---
