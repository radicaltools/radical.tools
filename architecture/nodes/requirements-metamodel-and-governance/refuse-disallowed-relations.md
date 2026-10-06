---
id: "f0599b8e-b781-4d1a-b7e8-24551f1519d9"
type: "requirement"
label: "Refuse disallowed relations"
action: "The system shall refuse the relation with the message \"Relation not allowed: <source type> → <target type>\"."
ears_type: "unwanted-behaviour"
rationale: "Only meaningful connections enter the model; a relation type with an empty pair list allows any pair and so switches the check off. Evidence: packages/common/src/metamodel/types.ts:130; apps/studio/src/renderer/src/components/MetamodelEditor.tsx:382-385; packages/common/src/model.ts:210-215; packages/common/src/metamodel/lookup.ts:22-32; packages/ui/src/store/diagramStore.ts:1825-1834; apps/e2e/tests/studio/editing.spec.ts:37-46; manual#relations"
unwanted_condition: "a new relation's source and target types are not an allowed pair of any relation type and no relation type allows any pair"
---
