---
id: "0aca864e-45f0-45ed-b38a-3da9eb61d68d"
type: "requirement"
label: "Conditional property visibility"
action: "The system shall hide that property in the properties panel, on the wiki page and in the wizard."
ears_type: "state-driven"
precondition: "a property's \"visible when\" field does not hold one of the listed values"
rationale: "Forms show only the fields that apply, e.g. only the EARS clauses the chosen pattern uses. Evidence: packages/common/src/metamodel/types.ts:20-23; packages/common/src/metamodel/lookup.ts:5-10; packages/ui/src/components/RightPanel.tsx:1780-1787; packages/ui/src/components/WikiView.tsx:860-864; packages/common/src/metamodel/wizard.ts:62-77; manual#properties"
---
