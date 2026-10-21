---
id: "0f125eb5-6f65-4523-a583-3b4a0bec44b7"
type: "requirement"
label: "Validation issue list"
action: "The metamodel editor shall list every rule the current model breaks: unknown node or relation types, missing, disallowed or required parents, relations to no element and two properties of a type with one key or a reserved key as errors, and an element in a group whose place has no room for it, missing required properties (an empty list counting as missing, a property with a default not), a value that is no option of its enum any more, several references in a single reference property, minimum or maximum cardinality breaches, disallowed relation pairs, a relation type that does not connect its ends, a relation without a type where the metamodel has several for its pair, references to no node or a node of another type, and the state machine and aggregate rules as warnings, each element issue with an \"Open in Designer\" link; and the properties card shall show a value that is no option any more as it is."
ears_type: "ubiquitous"
rationale: "Existing models and changed rules can break constraints that edits never checked. Evidence: packages/common/src/metamodel/validate.ts:17-131; apps/studio/src/renderer/src/components/MetamodelEditor.tsx:453-490,710-731; manual#metamodel"
---
