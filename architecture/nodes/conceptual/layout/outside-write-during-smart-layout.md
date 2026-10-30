---
id: "ab2c5ee2-6cb2-4cfa-8ad0-b0d1ea2179cd"
type: "scenario"
label: "Outside write during Smart Layout"
given: "Smart Layout computing a layout for the canvas shown"
metrics: |
  test(packages/ui/tests/layoutCanvas.test.ts › A layout and the canvas it was started on › is applied when an outside write reloaded the model shown while it ran: what it added is placed, what it deleted left out) passed
  test(packages/ui/tests/layoutCanvas.test.ts › A layout and the canvas it was started on › places an element an outside write moved into another parent while it ran inside that parent, clear of its children) passed
then: "the layout is applied to the same canvas and Studio does not say it was not applied; the added element is placed as a new element, the deleted one is left out, and the moved one lies inside its new parent, clear of its children"
when: "an agent's write is reloaded before the layout lands: it adds an element, deletes another, and moves a third into another parent"
---
