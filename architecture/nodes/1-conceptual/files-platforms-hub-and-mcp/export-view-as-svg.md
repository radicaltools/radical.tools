---
id: "2f779eb4-2a74-4f92-9776-a93a56ed0593"
type: "scenario"
label: "Export view as SVG"
gherkin: "# Covered by: apps/e2e/tests/studio/export.spec.ts › export as SVG"
given: "the bookstore sample is open on the System context view"
then: "an .svg file is downloaded that contains Customer, Bookstore, Payment Provider and the browses and orders relation label"
when: "the user chooses Export as SVG… in the Radical menu"
---
