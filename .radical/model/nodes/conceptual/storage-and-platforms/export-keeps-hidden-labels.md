---
id: "0a8e03f1-cad8-45de-a322-2f563dea8270"
type: "scenario"
label: "Export keeps hidden labels"
given: "a canvas is zoomed out so far that it hides the relation labels"
metrics: "test(apps/e2e/tests/studio/export.spec.ts › an export zoomed out keeps the relation labels the canvas hides) passed"
then: "the picture holds the relation labels with none hidden, and the canvas hides them again afterwards"
when: "the user chooses Export as SVG…"
---
