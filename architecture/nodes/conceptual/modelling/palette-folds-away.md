---
id: "7b46a347-ae57-4d10-918d-1a92b26cad85"
type: "scenario"
label: "Palette folds away"
given: "the bookstore System Context view in Designer"
tests: "apps/e2e/tests/studio/editing.spec.ts › the palette sits above the canvas and the table, folds away and stays folded"
then: "the palette above the canvas shows the C4 group with Software System and the left panel has no palette items; folded, no chip shows, also after the reload; unfolded, the chips are back; the table view shows the palette, Viewer none"
when: "the user folds the palette away, reloads, unfolds it, opens the table view, and opens the canvas in Viewer"
---
