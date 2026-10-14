---
id: "c72b3a27-7a41-4ead-9017-1a66a7f1a1ef"
type: "scenario"
label: "Undo while typing"
given: "an element has just been added on the canvas"
tests: "apps/e2e/tests/studio/editing.spec.ts › the undo keys in a text field are about the typing, not the model"
then: "the first undo leaves the model unchanged and the second removes the added element"
when: "the user types in the search field and presses ⌘/Ctrl+Z, then leaves the field and presses ⌘/Ctrl+Z again"
---
