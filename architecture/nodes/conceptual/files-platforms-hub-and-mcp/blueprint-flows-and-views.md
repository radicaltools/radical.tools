---
id: "8be599a0-46ed-49ed-a3cf-f907b23a866c"
type: "scenario"
label: "Blueprint flows and views"
given: "every blueprint in the Hub catalogue"
tests: |
  packages/hub-catalogue/tests/catalogue.test.ts › blueprint mockups
  packages/hub-catalogue/tests/catalogue.test.ts › blueprint views and sequences
then: "each has at least eight mockups in flow groups linked by navigates-to with sanitised wireframes and one presented-by link, and views named System context, Containers, Governance, Mockups, two wikis, a technical flow and one flow view per screen flow"
when: "the catalogue is checked"
---
