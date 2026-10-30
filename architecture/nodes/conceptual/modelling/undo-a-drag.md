---
id: "a6ae0eb8-d2c8-41b1-89a7-5df13d9a990d"
type: "scenario"
label: "Undo a drag"
given: "the System Context view with a Software System just added"
metrics: |
  test(apps/e2e/tests/studio/physics.spec.ts › a drag is undone and redone as one step of its own) passed
  test(packages/ui/tests/dragUndo.test.ts › A drag as an undo step › held across a step that lands meanwhile (Smart Layout's result) gives back no mid-drag state (item 220)) passed
then: "the drop pins Customer; Undo puts it back and unpins it while the added system stays; Redo moves and pins it again; the second Undo removes the added system; a drag held while Smart Layout's result lands gives two steps, the layout and the drop, and Undo never gives back a mid-drag state"
when: "the user drags Customer, then presses Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Z twice"
---
