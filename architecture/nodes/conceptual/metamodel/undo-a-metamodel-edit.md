---
id: "ac010695-3210-4bb7-bd05-a31886d053da"
type: "scenario"
label: "Undo a metamodel edit"
given: "a model in Designer with elements of a custom type and a view of a viewpoint"
tests: |
  packages/ui/tests/undoSteps.test.ts › a metamodel edit is an undo step (decided 2026-10-21)
  packages/ui/tests/undoSteps.test.ts › undo after a viewpoint changed in the metamodel › "Save as viewpoint… → Replace" is one step, taken back with the viewpoint
  packages/ui/tests/undoSteps.test.ts › undo after a viewpoint changed in the metamodel › a viewpoint deleted in the metamodel editor comes back with its view
then: "Undo gives back the type and then its elements, the typed label as one step, the relation type added and deleted as a step each; setting a type to what it is makes no step; Save as viewpoint → Replace is one step, taken back with the viewpoint; a viewpoint deleted comes back with its view"
when: "the user deletes the type's elements and then the type, types a new label into a type, adds and deletes a relation type, sets a type to what it already is, saves a view as a viewpoint replacing another, deletes a viewpoint in the metamodel editor, and undoes each"
---
