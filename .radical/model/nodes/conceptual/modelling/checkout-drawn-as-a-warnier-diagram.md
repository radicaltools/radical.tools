---
id: "dda44512-f6cb-4c2a-9446-e7ce7240c292"
type: "scenario"
label: "Checkout drawn as a Warnier diagram"
given: "a model with the Checkout process and its steps"
metrics: "test(apps/e2e/tests/studio/warnier.spec.ts › a process is drawn as a Warnier diagram and a double-click opens the step) passed"
then: "Checkout stands left with its steps in a brace, in order, \"(1,n) for each order line\" under the repeated step and ⊕ between the payment alternatives; the click selects the step and the double-click opens its properties card; the structure view reads as braces too"
when: "the user creates a view of the viewpoint Process (Warnier), then clicks a step and double-clicks it, then switches a structure view to Warnier"
---
