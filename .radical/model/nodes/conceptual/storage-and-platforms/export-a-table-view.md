---
id: "bb4899cf-da3a-4bab-b853-e72aa2f107a8"
type: "scenario"
label: "Export a table view"
given: "a table view is active"
metrics: |
  test(apps/e2e/tests/studio/export.spec.ts › views without a canvas › a table view is exported too) passed
  test(apps/e2e/tests/studio/export.spec.ts › views without a canvas › a Warnier view is exported, without its step buttons) passed
  test(apps/e2e/tests/studio/export.spec.ts › views without a canvas › a wiki is exported without its editing controls) passed
then: "Studio downloads a PNG picture named after the view and an SVG holding the table's content; the Warnier view and the wiki are exported without their step buttons and editing controls"
when: "the user chooses Export as PNG… and then Export as SVG… on a table, a Warnier view and a wiki"
---
