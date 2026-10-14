---
id: "43ef22f0-2f82-4ba9-bc4e-cb28aa6e597b"
type: "scenario"
label: "Failed test in the Inspector"
given: "a folder model with a requirement verified by a scenario that names one test, and no check report yet"
tests: |
  apps/e2e/tests/studio/inspector.spec.ts
  apps/e2e/tests/studio/inspector.spec.ts › the Inspector shows what radical check says, and its links lead to the element
then: "the button is greyed out until the report is there, the Inspector shows one error and the requirement it leaves unverified, the requirement's panel says broken and names the scenario, Designer opens on the view that shows it with the requirement selected, and a passing run clears the error"
when: "radical check writes a report in which that test failed, the user opens the Inspector, follows the requirement's link and picks Show on canvas"
---
