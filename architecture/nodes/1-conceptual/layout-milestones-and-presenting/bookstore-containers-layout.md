---
id: "5bfbaca8-673b-454c-9b86-db8080e63820"
type: "scenario"
label: "Bookstore containers layout"
gherkin: |
  And the canvas matches the reference screenshot smart-layout-bookstore-containers.png
  # Covered by: apps/e2e/tests/studio/layout.spec.ts › bookstore containers
given: "the bookstore fixture is open on the Containers view"
then: "the view shows six elements with no overlapping siblings and no child outside its parent"
when: "the user runs Smart Layout and the saved result is reopened"
---
