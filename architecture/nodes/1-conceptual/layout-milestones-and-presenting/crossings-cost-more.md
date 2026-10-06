---
id: "268f6aed-e448-4fdc-a167-4a8c24de255f"
type: "scenario"
label: "Crossings cost more"
gherkin: "# Covered by: packages/layout/tests/smartLayout.test.ts › scores a layout with crossing edges worse than an equivalent one without"
given: "two layouts of the same graph, one with crossing edges and one without"
then: "the layout with crossings gets the higher composite cost"
when: "both are scored"
---
