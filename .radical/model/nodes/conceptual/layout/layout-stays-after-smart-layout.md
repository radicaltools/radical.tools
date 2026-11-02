---
id: "f77c1ec5-a736-4479-9691-c7cab9c2f9c9"
type: "scenario"
label: "Layout stays after Smart Layout"
given: "a diagram under 150 elements open on a canvas; and views with an empty container, and with elements whose container they do not draw"
metrics: |
  test(packages/layout/tests/liveColaRest.test.ts › keeps it when its positions are replaced (a view switch, an undo, Smart Layout)) passed
  test(packages/layout/tests/liveColaRest.test.ts › keeps it when it is opened) passed
  test(apps/e2e/tests/studio/physics.spec.ts › the layout Smart Layout gives is the one that stays and is saved) passed
  test(packages/layout/tests/geometry.test.ts › placeUnplaced › measures a container with nothing in it at the size the canvas draws it (F-0049)) passed
  test(packages/layout/tests/geometry.test.ts › placeUnplaced › takes no child for astray in a container the view does not draw (F-0049)) passed
then: "no element moves after the layout is applied, and the reloaded canvas shows the same positions; the empty container is measured at the size it is drawn, nothing inside an undrawn container is placed afresh, and the views open as they were saved"
when: "the user runs Smart Layout, waits, and reloads the page; and the views are opened again"
---
