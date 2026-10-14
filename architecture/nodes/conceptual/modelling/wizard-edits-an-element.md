---
id: "d4bd7629-9519-407f-af02-b83dbf49c04b"
type: "scenario"
label: "Wizard edits an element"
given: "an existing element whose type has a wizard"
tests: "packages/ui/tests/nodeWizard.test.ts › edit mode › patches changed values and syncs the covered links"
then: "only the changed values are written and the relations the wizard covers are added or removed to match"
when: "the wizard is opened on it and saved with changes"
---
