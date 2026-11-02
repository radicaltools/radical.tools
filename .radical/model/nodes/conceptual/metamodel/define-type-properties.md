---
id: "5695b57f-3488-472f-ad04-ae53dd366ede"
type: "requirement"
label: "Define type properties"
action: "The metamodel editor shall let the user define properties on node and relation types with a key, a label, a type (text, long text, number, boolean, enum, or a reference to one or several nodes of a chosen type), a required flag and, for enums, a list of options, taken when the options field is left (asking at most once, and only about options in use it would drop) and kept as the field shows them when the editor closes with Esc."
ears_type: "ubiquitous"
rationale: "Properties drive the forms, table columns and validation for every element of the type. Exploratory runs 65 to 69 (2026-10-21, item 243) found typing an enum's first options asking at every letter, and options being typed lost when the editor closed with Esc. Evidence: apps/studio/src/renderer/src/components/MetamodelEditor.tsx:37-116,304-308,440-444 (EnumOptionsInput); packages/common/src/metamodel/types.ts:10-24; manual#metamodel; manual#properties"
---
