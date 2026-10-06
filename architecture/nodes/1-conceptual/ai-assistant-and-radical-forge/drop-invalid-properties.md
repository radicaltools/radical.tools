---
id: "cff8468e-6cfe-4fc3-9bd2-28a39b053745"
type: "requirement"
label: "Drop invalid properties"
action: "The AI tool catalogue shall drop that property, apply the rest of the change, and tell the model which property was ignored and why."
ears_type: "unwanted-behaviour"
rationale: "Governance fields (EARS type, ADR status) stay valid without failing whole edits. Evidence: packages/common/src/ai/tools/propertyBag.ts:10-43; packages/common/src/ai/tools/nodeTools.ts:91-92,119; packages/common/src/ai/tools/relationTools.ts:97-100"
unwanted_condition: "the AI sets a property the element or relation type does not define, or a value of the wrong kind or outside an enum's options"
---
