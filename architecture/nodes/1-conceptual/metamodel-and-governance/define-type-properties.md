---
id: "5695b57f-3488-472f-ad04-ae53dd366ede"
type: "requirement"
label: "Define type properties"
action: "The metamodel editor shall let the user define properties on node and relation types with a key, a label, a type (text, long text, number, boolean or enum), a required flag and, for enums, a list of options."
ears_type: "ubiquitous"
rationale: "Properties drive the forms, table columns and validation for every element of the type. Evidence: apps/studio/src/renderer/src/components/MetamodelEditor.tsx:37-116,304-308,440-444; packages/common/src/metamodel/types.ts:10-24; manual#metamodel; manual#properties"
---
