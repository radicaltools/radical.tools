---
id: "386f0c8b-8d0b-420c-82d7-910ed3e7e162"
type: "scenario"
label: "Too large a canvas offers a table"
given: "a model of 1,001 requirements and a system, a canvas view whose filter gives every requirement, and a canvas of the system"
metrics: |
  test(apps/e2e/tests/studio/large-canvas.spec.ts › a canvas of more than 1,000 elements is not drawn: it offers a table or its filter) passed
  test(packages/ui/tests/oversizedCanvas.test.ts › a canvas with more elements than a canvas draws › draws up to CANVAS_MAX_ELEMENTS, and says how many past them) passed
  test(packages/ui/tests/oversizedCanvas.test.ts › a canvas with more elements than a canvas draws › leaves tables, wikis and All elements to show any number) passed
then: "in place of the canvas Studio says the view shows 1,001 elements and a canvas draws up to 1,000, and draws none; the view's properties open; the system's canvas is drawn; the view becomes a table with its rows; a view of exactly 1,000 is drawn, and tables, wikis and All elements are never held back"
when: "the view of every requirement is opened; Edit the filter is pressed; the canvas of the system is opened; the first view is opened again and Show as a table is pressed"
---
