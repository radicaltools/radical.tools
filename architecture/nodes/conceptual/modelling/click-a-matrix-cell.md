---
id: "b5ae57ff-99f9-4c18-8e50-a8ff76ea6e8b"
type: "scenario"
label: "Click a matrix cell"
given: "a matrix view of the bookstore, with the calls relation already selected, on a canvas view or by a click on its cell in Viewer"
metrics: |
  test(apps/e2e/tests/studio/matrix.spec.ts › one click on a cell selects its relation, even when it was selected on another view) passed
  test(apps/e2e/tests/studio/runs-13-24.spec.ts › one click on a matrix cell selected in Viewer does not remove it in Designer) passed
  test(apps/e2e/tests/studio/matrix.spec.ts › the popup of a cell with several relations stays in the window, and goes when the matrix scrolls) passed
then: "the relation is selected and stays in the model; a second click on the same cell removes it; the popup of a cell with several relations stays in the window, and goes when the matrix scrolls"
when: "the user clicks the relation's marked cell once in Designer"
---
