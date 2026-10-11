---
id: "e140c110-780c-4b42-b68e-696cf8f27046"
type: "scenario"
label: "Add element from palette"
gherkin: |
  And the stored model holds the new node
  # Covered by: apps/e2e/tests/studio/editing.spec.ts › add an element from the palette
given: "the bookstore System Context view with 3 elements"
then: "a fourth element labelled System appears on the canvas"
when: "the user drops a Software System from the palette on an empty spot"
---
