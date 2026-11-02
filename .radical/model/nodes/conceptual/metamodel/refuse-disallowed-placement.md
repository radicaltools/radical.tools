---
id: "b380d6cc-e776-4605-90ec-9c9502cf03a7"
type: "requirement"
label: "Refuse disallowed placement"
action: "The system shall refuse the change and show a message naming the allowed parents."
ears_type: "unwanted-behaviour"
rationale: "Containment rules keep the C4 levels intact; the root is allowed when allowedAtRoot is true, or when it is unset and the type lists no parents. Evidence: packages/common/src/model.ts:82-113,124-133,146-163; packages/common/src/metamodel/lookup.ts:53-74; packages/ui/src/components/Canvas.tsx:715-740; manual#elements"
unwanted_condition: "a node is created, moved or retyped into a parent type, or onto the canvas root, that its type does not allow"
---
