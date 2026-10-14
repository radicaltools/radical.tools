---
id: "506f0713-61f1-40c9-89fe-0b1dbf794505"
type: "scenario"
label: "All elements layout kept"
given: "All elements and the System Context view placing their shared elements differently"
tests: |
  apps/e2e/tests/studio/physics.spec.ts › All elements keeps its own layout › a reload while a view is shown does not give All elements that view's layout
  apps/e2e/tests/studio/physics.spec.ts › All elements keeps its own layout › nor does a reload while a milestone is shown in a view
then: "All elements shows its own positions and breaks no layout rule"
when: "the page reloads while System Context is shown, or while a milestone is shown in it, and the user goes back to All elements"
---
