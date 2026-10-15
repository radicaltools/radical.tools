---
id: "50ad9060-b3dc-46cd-a2bf-59ff43b96040"
type: "scenario"
label: "Table adds in the tree"
given: "the bookstore Element Table, which has no chain"
tests: "apps/e2e/tests/studio/editing.spec.ts › the table adds an element at the top and inside a row"
then: "the container is inside the system, and Viewer shows no + row"
when: "the user adds a Software System from the + row at the end and a Container from the + row under it, picking each from the list and naming it in its row, then opens the table in Viewer"
---
