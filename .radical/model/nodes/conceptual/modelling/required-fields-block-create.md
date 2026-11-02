---
id: "b1bb1a5f-2c81-4e51-862a-e904a51aff57"
type: "requirement"
label: "Required fields block create"
action: "the node wizard shall disable Create and list the missing fields."
ears_type: "state-driven"
precondition: "a required wizard field is empty"
rationale: "Required fields from the metamodel must be filled before the element exists. Evidence: packages/ui/src/components/NodeWizard.tsx:96,118-121,232-243; manual#properties"
---
