---
id: "40680d72-2939-4952-a0af-12ffa4a1f664"
type: "scenario"
label: "Modelling from nothing with Smart fit"
given: "an empty view with Smart fit on"
tests: "apps/e2e/tests/studio/physics.spec.ts › modelling from nothing, Smart fit shows the first element at its size and leaves the camera alone while what is added stays in sight"
then: "the first stands at no more than 100 %, under half the canvas wide; the second leaves the camera where it was"
when: "the user drops a software system from the palette, then a second one where it is still in sight"
---
