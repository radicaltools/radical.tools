---
id: "6a6cac6f-ff32-41ad-a921-37decf968ca9"
type: "scenario"
label: "Hub landing shows categories"
gherkin: "And a Browse the catalogue button is shown"
given: "the Hub catalogue is published"
metrics: "test(apps/e2e/tests/hub/hub.spec.ts › landing page) passed"
then: "one tile per concern group is shown with the number of packs in it"
when: "the user opens the Hub landing page"
---
