---
id: "3b21468e-05eb-4a1d-bbe6-eff7b11f712d"
type: "scenario"
label: "Drag with its container"
given: "a container and one of its children selected together, by Shift-click or by a Shift box selection"
metrics: |
  test(apps/e2e/tests/studio/runs-13-24.spec.ts › dragging an element whose container is also selected moves and saves them) passed
  test(apps/e2e/tests/studio/runs-13-24.spec.ts › dragging a child of a box-selected container moves and saves them, as one undo step) passed
  test(apps/e2e/tests/studio/physics.spec.ts › a drop that moves its group's edge is saved where it is drawn, and Redo and a reload draw it there (30 px)) passed
  test(apps/e2e/tests/studio/physics.spec.ts › a drop that moves its group's edge is saved where it is drawn, and Redo and a reload draw it there (120 px)) passed
then: "the container moves with it; the new positions come back after a reload, and one Ctrl/Cmd+Z puts the container back"
when: "the user drags the child"
---
