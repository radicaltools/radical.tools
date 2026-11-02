---
id: "e255e6d9-e235-4ce0-85f9-d729fa8a5ff0"
type: "scenario"
label: "State reads in wiki"
given: "a state-driven requirement whose precondition points at the Confirmed state of the Order machine"
metrics: |
  test(apps/e2e/tests/studio/runs-13-24.spec.ts › the wiki › a requirement pointing at a state reads by the state, as on the canvas) passed
  test(apps/e2e/tests/studio/state-machines.spec.ts › the card's sentence of a requirement in a state names the state) passed
then: "its sentence reads \"While the Order is Confirmed\", as on the canvas, and so does its properties card"
when: "the user opens its wiki page"
---
