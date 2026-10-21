---
id: "7776f427-ed30-4e44-abf8-a065dbf1e7ad"
type: "scenario"
label: "Undo shows its canvas"
given: "a model with two views, an element dragged on one of them and another on All elements"
tests: "packages/ui/tests/historyScope.test.ts › Undo and the canvas a step was made on"
then: "Undo goes back to the canvas the step was made on and gives the step back there, leaving the canvas shown before as it was; a step made on All elements is given back there, also when it is redone from a view"
when: "the user opens the other view and presses Undo, then Redo from a view"
---
