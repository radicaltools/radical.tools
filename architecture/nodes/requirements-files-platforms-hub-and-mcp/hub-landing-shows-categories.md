---
id: "6a6cac6f-ff32-41ad-a921-37decf968ca9"
type: "scenario"
label: "Hub landing shows categories"
gherkin: |
  And a Browse the catalogue button is shown
  # Covered by: apps/e2e/tests/hub/hub.spec.ts › landing page
given: "the Hub catalogue is published"
then: "Patterns, ADRs and Blueprints are shown with the number of concepts in each category"
when: "the user opens the Hub landing page"
---
