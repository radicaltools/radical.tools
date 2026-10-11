---
id: "e0003b37-6fa0-49f3-9a3b-a8f955e84058"
type: "scenario"
label: "ADR wizard creates with links"
gherkin: |
  And nothing is created while the wizard is open
  # Covered by: apps/e2e/tests/studio/wizard.spec.ts › dropping an ADR on the canvas opens its wizard; finishing creates it with its relations
given: "the bookstore model on the Governance metamodel"
then: "the ADR appears on the canvas with status proposed and a Constrains relation to Bookstore"
when: "the user drops an ADR, names it, fills Context, ticks Bookstore under Affected elements and clicks Create"
---
