---
id: "a6ae0eb8-d2c8-41b1-89a7-5df13d9a990d"
type: "scenario"
label: "Undo a drag"
given: "the System Context view with a Software System just added"
tests: "apps/e2e/tests/studio/physics.spec.ts › a drag is undone and redone as one step of its own"
then: "the drop pins Customer; Undo puts it back and unpins it while the added system stays; Redo moves and pins it again; the second Undo removes the added system"
when: "the user drags Customer, then presses Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Z twice"
---
