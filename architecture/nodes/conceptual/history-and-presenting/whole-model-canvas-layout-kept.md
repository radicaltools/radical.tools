---
id: "506f0713-61f1-40c9-89fe-0b1dbf794505"
type: "scenario"
label: "Whole-model canvas layout kept"
given: "a structure view of the whole model and the System Context view placing their shared elements differently"
tests: |
  apps/e2e/tests/studio/physics.spec.ts › a canvas of the whole model keeps its own layout › a reload while a view is shown does not give it that view's layout
  apps/e2e/tests/studio/physics.spec.ts › a canvas of the whole model keeps its own layout › nor does a reload while a milestone is shown in a view
then: "the whole-model view shows its own positions and breaks no layout rule"
when: "the page reloads while System Context is shown, or while a milestone is shown in it, and the user goes back to the whole-model view"
---
