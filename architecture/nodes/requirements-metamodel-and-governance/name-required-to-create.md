---
id: "a808de10-1f55-4107-8e02-5c366b6ac41f"
type: "scenario"
label: "Name required to create"
gherkin: "# Covered by: packages/common/tests/nodeWizard.test.ts › requires a name"
given: "a create-time wizard whose Name field is empty"
then: "Create is disabled and \"Required: Name\" is shown"
when: "the user looks at the wizard footer"
---
