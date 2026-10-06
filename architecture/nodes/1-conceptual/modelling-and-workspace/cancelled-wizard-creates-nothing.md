---
id: "8e459805-2f14-437d-830c-b5dd94ba17e3"
type: "scenario"
label: "Cancelled wizard creates nothing"
gherkin: "# Covered by: apps/e2e/tests/studio/wizard.spec.ts › cancelling the wizard creates nothing"
given: "the ADR wizard opened by a palette drop"
then: "the wizard closes and the canvas still has 3 elements"
when: "the user presses Esc"
---
