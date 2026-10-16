---
id: "589b564c-b1eb-4f30-9f48-af7ec2949591"
type: "scenario"
label: "All elements opens as a table"
given: "the welcome screen, the bookstore model, and a link to the former All elements canvas"
tests: |
  apps/e2e/tests/studio/boot.spec.ts › first visit › a new model starts empty
  apps/e2e/tests/studio/viewpoints.spec.ts › a blank view is a table of every element
  apps/studio/tests/route.test.ts › route parse/format › opens a link to the All elements canvas of before on All elements
then: "the new model opens on All elements, an empty table with a + row; the blank view is a table of the bookstore's six elements; the old link opens All elements (view all)"
when: "the user creates a new model; adds a blank view with + New view; and opens #/m/designer/v/canvas"
---
