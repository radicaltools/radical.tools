---
id: "daf3ff10-ec99-4c6b-a63f-dcd7d5cfbea9"
type: "requirement"
label: "Fill in with wizard"
action: "The system shall open the type's wizard with the node's current values and links, and on Save write only the changed fields and add or remove relations to match the picks."
ears_type: "event-driven"
rationale: "The guided form stays useful after creation without overwriting what it did not show. Evidence: packages/ui/src/components/RightPanel.tsx:1842-1846; packages/ui/src/store/diagramStore.ts:1504-1555; packages/common/src/metamodel/wizard.ts:109-134; manual#properties"
trigger: "the user chooses \"Fill in with wizard…\" in the properties panel of an existing node"
---
