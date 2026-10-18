---
id: "c5cf7827-5129-4aed-82f9-3f10ba772f66"
type: "scenario"
label: "Processes and a custom type on the canvas"
given: "a model with the Checkout process and its steps, and an element of a type Risk added to the metamodel"
tests: |
  apps/e2e/tests/studio/warnier.spec.ts › a process and an element of a custom type are drawn on the canvas
  apps/e2e/tests/studio/warnier.spec.ts › a step dropped on a step goes inside it, and every frame holds what it holds
  packages/common/tests/warnier.test.ts › processFlow
then: "Checkout is a frame with its steps inside, Reserve stock shows (1,n) and for each order line under its name, Pay holds By card and By invoice and its header ⊕, each alternative (0,1); dashed arrows run Take the order → Reserve stock → Pay and none between By card and By invoice; the risk is a card naming its type Risk, in its colour, with its name; the dropped step lands inside the step, which grows, and the process grows with it"
when: "a structure view of them is opened; then, on a canvas, a process is added, a step dropped on it and a step dropped on that step"
---
