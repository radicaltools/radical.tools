---
id: "3eca9467-7cfd-4cd1-9ce2-9fef4fc8630f"
type: "scenario"
label: "New view undone at once"
given: "a model on the Radical metamodel in Designer"
metrics: |
  test(packages/ui/tests/firstCanvasPositions.test.ts › the first layout of a view (decided 2026-10-21)) passed
  test(packages/ui/tests/brokenModels.test.ts › opens a view saved without a positions key as one not laid out yet) passed
then: "one Undo takes the new view away with its first layout; opening the existing view adds no step and the Undo after it keeps the layout; the first layout is not replaced by All elements' places; the view without positions opens as one not laid out yet"
when: "the user makes a new structure view of a viewpoint and undoes it; opens an existing view with no positions of its own and presses Undo; a reload saves All elements' places before a view's first layout lands; and a view saved without a positions key is opened"
---
