---
id: "0f125eb5-6f65-4523-a583-3b4a0bec44b7"
type: "requirement"
label: "Validation issue list"
action: "The metamodel editor shall list every rule the current model breaks: unknown types and missing, disallowed or required parents as errors, and missing required properties, minimum or maximum cardinality breaches and disallowed relation pairs as warnings, each element issue with an \"Open in Designer\" link."
ears_type: "ubiquitous"
rationale: "Existing models and changed rules can break constraints that edits never checked. Evidence: packages/common/src/metamodel/validate.ts:17-131; apps/studio/src/renderer/src/components/MetamodelEditor.tsx:453-490,710-731; manual#metamodel"
---
