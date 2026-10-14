---
id: "996b2acf-551f-48e5-a74d-fd54bbd55b2f"
type: "requirement"
label: "Required fields block finish"
action: "The system shall disable Create (or Save) and list the missing fields."
ears_type: "state-driven"
precondition: "a required field visible in the wizard is empty"
rationale: "Every element gets at least a name. Evidence: packages/common/src/metamodel/wizard.ts:29-33,148-164; packages/ui/src/components/NodeWizard.tsx:96,233-242; packages/common/tests/nodeWizard.test.ts:81-87"
---
