---
id: "87184e2f-0910-4399-8efe-49b1033531e8"
type: "scenario"
label: "Align a container's children"
gherkin: "# Covered by: apps/e2e/tests/studio/alignment.spec.ts › a selected container aligns its children, in the order they stand"
given: "the bookstore fixture is open on the Containers view, where Bookstore holds Web App, API and Orders DB"
then: "the three children share one horizontal line in the left-to-right order they stood in, the view stores that order, and the row's guide shows its buttons while Bookstore stays selected"
when: "the user selects only Bookstore and chooses Align children… → Keep in a row"
---
