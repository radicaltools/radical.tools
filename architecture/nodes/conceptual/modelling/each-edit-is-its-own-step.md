---
id: "a19992e7-551a-4e13-afec-2f1e9f261e10"
type: "scenario"
label: "Each edit is its own step"
given: "a model in Designer with a new view of the viewpoint Containers, a wiki view with an element written in it, and an element selected"
metrics: |
  test(packages/ui/tests/undoSteps.test.ts › a change of view type) passed
  test(packages/ui/tests/undoSteps.test.ts › undo after a viewpoint changed in the metamodel) passed
  test(packages/ui/tests/undoSteps.test.ts › the selection after an undo) passed
  test(packages/ui/tests/undoSteps.test.ts › Hide from view of what the view does not show) passed
  test(packages/ui/tests/undoSteps.test.ts › Multi page and Depth of a wiki) passed
  test(packages/ui/tests/undoSteps.test.ts › the Auto-layout of a view (decided 2026-10-21)) passed
  test(apps/e2e/tests/studio/editing.spec.ts › undoing the add of the selected element leaves no card and no selection) passed
then: "each change is one undo step, taken back in turn and given back by Redo, with no error; the Auto-layout stays as set when an earlier step is undone; a change to what a view already is, or a hide of nothing, is no step; the selection drops what the undo took away, and its card closes"
when: "the user changes the view's type, saves a view as a viewpoint replacing another, sets Multi page and Depth, sets the view's Auto-layout, hides from a view what it does not show, and undoes each, also the add of the selected element"
---
