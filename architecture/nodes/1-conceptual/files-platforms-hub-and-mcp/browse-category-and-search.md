---
id: "9991fb44-61a0-432d-9a13-ba54cbd69dc8"
type: "scenario"
label: "Browse category and search"
gherkin: "# Covered by: apps/e2e/tests/hub/hub.spec.ts › browse a category and search"
given: "the Hub landing page is open"
then: "only blueprints are listed with the link #/cat/blueprint, and the search shows the Fintech Ledger blueprint but not the AI Support Assistant one"
when: "the user clicks Blueprints and then searches for ledger"
---
