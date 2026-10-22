---
id: "16539665-d1c9-4cda-a8fa-8f76cad29b02"
type: "scenario"
label: "Working from the keyboard"
given: "a model with many possible parents, views, milestones and sequences, a selection on the canvas and a table view"
tests: |
  apps/e2e/tests/studio/editing.spec.ts › Move to… with many parents stays in the window and scrolls
  apps/e2e/tests/studio/editing.spec.ts › a menu of the activity rail answers ↑ and ↓ and closes when Tab leaves it
  apps/e2e/tests/studio/editing.spec.ts › view, milestone and sequence cards open from the keyboard
  apps/e2e/tests/studio/editing.spec.ts › Escape clears the selection on the canvas
  apps/e2e/tests/studio/editing.spec.ts › ⌘+ on a table leaves the browser its zoom, and the canvas after it draws without errors
  apps/e2e/tests/studio/editing.spec.ts › a name written in the table leaves the keyboard on its row
then: "Move to… stays in the window and scrolls; the menu answers the arrows and closes when Tab leaves it; each card opens; Esc clears the selection; the browser keeps its zoom and the canvas draws without errors; the keyboard stays on the row"
when: "the user opens Move to…, opens the rail's Models menu and moves in it with ↑ and ↓ and Tab, focuses a view, milestone and sequence card and presses Enter, presses Esc on the canvas, presses ⌘+ on the table and then opens a canvas, and writes a name in the table"
---
