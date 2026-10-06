---
id: "4e70122a-84a8-49dc-887d-3ecc81756b94"
type: "scenario"
label: "Unknown concept link"
gherkin: "# Covered by: apps/e2e/tests/hub/hub.spec.ts › an unknown concept link falls back to the catalogue"
given: "a Hub link to #/c/no-such-concept"
then: "the catalogue with its search box is shown and no diagram is drawn"
when: "the user opens the link"
---
