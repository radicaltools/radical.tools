---
id: "bb4899cf-da3a-4bab-b853-e72aa2f107a8"
type: "scenario"
label: "Export a table view"
given: "a table view is active"
tests: "apps/e2e/tests/studio/export.spec.ts › views without a canvas › a table view is exported too"
then: "Studio downloads a PNG picture named after the view and an SVG holding the table's content"
when: "the user chooses Export as PNG… and then Export as SVG…"
---
