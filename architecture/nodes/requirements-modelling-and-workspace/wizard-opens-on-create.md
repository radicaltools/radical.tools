---
id: "c59258ac-0233-4ab8-9a98-063a5a78a41e"
type: "requirement"
label: "Wizard opens on create"
action: "Studio shall open the node wizard for the new element instead of creating it."
ears_type: "event-driven"
rationale: "A guided walk through the fields and links produces governance records with substance, not just a title. Evidence: packages/ui/src/store/diagramStore.ts:1485-1501; packages/ui/src/components/NodeWizard.tsx:24-39; packages/common/src/metamodel/presets/governance.ts:160-172; packages/ui/tests/nodeWizard.test.ts:51; manual#properties"
trigger: "the user creates an element whose type defines a create wizard, from the canvas, a table or a wiki page"
---
