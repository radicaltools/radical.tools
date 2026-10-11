---
id: "23a37c7c-3d60-469c-a2ad-8ed12ca63872"
type: "scenario"
label: "Grid in selection order"
gherkin: "# Covered by: apps/e2e/tests/studio/alignment.spec.ts › a grid fills in selection order and takes another column from the canvas"
given: "the bookstore fixture is open on the Containers view and the user selects Orders DB, Web App, Payment Provider and API in that order"
then: "the four sit in two rows and two columns in reading order, then in three columns with API alone in the second row, and the view stores a 3-column grid"
when: "the user chooses Align… → Keep in a grid, then More grid columns on the canvas guide"
---
