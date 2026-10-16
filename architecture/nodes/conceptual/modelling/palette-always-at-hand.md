---
id: "7b46a347-ae57-4d10-918d-1a92b26cad85"
type: "scenario"
label: "Palette always at hand"
given: "the bookstore System Context view in Designer"
tests: "apps/e2e/tests/studio/editing.spec.ts › the palette stands down the canvas's left side, always there, and not on the table"
then: "the palette shows the C4 group with Software System, down the canvas's left edge, taller than wide, one type under the other, with nothing that folds it away; the left panel has no palette items; the table view and Viewer show no palette"
when: "the user looks at the canvas, opens the table view, and opens the canvas in Viewer"
---
