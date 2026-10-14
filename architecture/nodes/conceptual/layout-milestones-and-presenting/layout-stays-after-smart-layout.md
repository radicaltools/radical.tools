---
id: "f77c1ec5-a736-4479-9691-c7cab9c2f9c9"
type: "scenario"
label: "Layout stays after Smart Layout"
gherkin: ""
given: "a diagram under 150 elements open on a canvas"
tests: |
  packages/layout/tests/liveColaRest.test.ts › keeps it when its positions are replaced (a view switch, an undo, Smart Layout)
  packages/layout/tests/liveColaRest.test.ts › keeps it when it is opened
  apps/e2e/tests/studio/physics.spec.ts › the layout Smart Layout gives is the one that stays and is saved
then: "no element moves after the layout is applied, and the reloaded canvas shows the same positions"
when: "the user runs Smart Layout, waits, and reloads the page"
---
