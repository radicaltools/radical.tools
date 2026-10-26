---
id: "e4419b5a-d8ae-4230-a3f4-6d715cb16f84"
type: "scenario"
label: "Undo keys in either case"
given: "a name changed in the Element Table"
tests: "apps/e2e/tests/studio/editing.spec.ts › Ctrl+Shift+Z redoes and Ctrl+Z undoes whatever the letter's case"
then: "Ctrl+Z undoes the change and Ctrl+Shift+Z redoes it, whatever the letter's case"
when: "the user presses Ctrl+Z, then Ctrl+Shift+Z, with the letter sent in upper and in lower case"
---
