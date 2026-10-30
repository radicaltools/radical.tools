---
id: "4e70122a-84a8-49dc-887d-3ecc81756b94"
type: "scenario"
label: "Unknown concept link"
given: "a Hub link to #/c/no-such-concept"
metrics: "test(apps/e2e/tests/hub/hub.spec.ts › an unknown concept link falls back to the catalogue) passed"
then: "the catalogue with its search box is shown and no diagram is drawn"
when: "the user opens the link"
---
