---
id: "c0954576-cf5d-4f9e-9bbc-dda700f3ad08"
type: "scenario"
label: "System Context renders collapsed"
gherkin: |
  And the container relations to Payment Provider are drawn from the collapsed Bookstore box
  # Covered by: apps/e2e/tests/studio/views.spec.ts › System Context (static)
given: "the bookstore model whose System Context view lists Customer, Bookstore and Payment Provider but none of Bookstore's containers"
then: "the canvas shows 3 elements and 2 relations under the caption 'Structure: System Context'"
when: "the user opens the System Context view by deep link"
---
