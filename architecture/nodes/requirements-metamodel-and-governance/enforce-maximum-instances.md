---
id: "e9772f85-ac74-4f12-9ba1-b6e1ef717ae7"
type: "requirement"
label: "Enforce maximum instances"
action: "The system shall refuse the node and show a message naming the maximum."
ears_type: "unwanted-behaviour"
rationale: "Cardinality limits (one landscape, at most three domains…) are part of the notation. Evidence: packages/common/src/model.ts:101-107; packages/common/src/metamodel/lookup.ts:76-90; manual#elements"
unwanted_condition: "adding a node would exceed its type's maximum instances"
---
