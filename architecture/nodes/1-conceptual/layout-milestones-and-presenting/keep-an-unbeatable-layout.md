---
id: "35d8f341-ebd5-45e9-bb39-53334de4940a"
type: "scenario"
label: "Keep an unbeatable layout"
gherkin: "# Covered by: packages/layout/tests/smartLayout.test.ts › keeps the current layout when running again cannot beat it"
given: "a view was just laid out by Smart Layout"
then: "nothing moves and Studio reports that the current layout already scores best"
when: "the user runs Smart Layout again"
---
