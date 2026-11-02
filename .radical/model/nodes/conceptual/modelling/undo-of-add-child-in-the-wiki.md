---
id: "989454a8-af2d-4ffb-b5ea-6f96d95b4052"
type: "scenario"
label: "Undo of Add child in the wiki"
given: "a wiki of the bookstore in Designer"
metrics: "test(apps/e2e/tests/studio/wiki.spec.ts › a wiki of the bookstore › Undo of Add child goes back to the Overview, and so does the address) passed"
then: "the child is gone and the wiki and the address go back to the Overview"
when: "the user adds a child on a page, which opens the child's page, and presses Undo"
---
