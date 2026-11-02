---
id: "43ef22f0-2f82-4ba9-bc4e-cb28aa6e597b"
type: "scenario"
label: "Failed test in the Inspector"
given: "a folder model with a requirement verified by a scenario that names one test, and no check report yet"
metrics: |
  test(apps/e2e/tests/studio/inspector.spec.ts) passed
  test(apps/e2e/tests/studio/inspector.spec.ts › the Inspector shows what radical check says, and its links lead to the element) passed
then: "the button is greyed out until the report is there; Model quality shows no error, the model being complete; Implementation shows one error, the requirement it leaves unverified and 0 of 1 requirements verified, 1 broken; the requirement's panel says broken and names the scenario, Show on canvas offers the Specification view, Designer opens on it with the requirement selected, and a passing run clears the error"
when: "radical check writes a report in which that test failed, the user opens the Inspector, goes to its Implementation tab, follows the requirement's link, picks Show on canvas and the view it offers"
---
