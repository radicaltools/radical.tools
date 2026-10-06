---
id: "20a916db-a475-4eec-a751-11a3b3e16bf7"
type: "requirement"
label: "Wizard offers allowed links"
action: "The wizard's relation steps shall offer only existing nodes whose type the step's relation type allows for this node type, never the node itself, and skip a step whose relation type cannot involve the node type."
ears_type: "ubiquitous"
rationale: "The links picked in a wizard are always valid under the metamodel. Evidence: packages/common/src/metamodel/wizard.ts:79-107,136-146; packages/ui/src/store/diagramStore.ts:1180-1194; packages/common/tests/nodeWizard.test.ts:89-113"
---
