---
id: "8a93c06a-1e5c-4360-b2c6-c16a367ffc97"
type: "requirement"
label: "Infer the relation type"
action: "The system shall set its type to the one restricted relation type that allows the source and target pair, and leave it untyped when no type or several types match."
ears_type: "event-driven"
rationale: "Users draw a line and get Constrains, Verifies or Interacts without choosing from a list. Evidence: packages/common/src/model.ts:217-223; packages/common/src/metamodel/lookup.ts:34-51; packages/ui/src/components/RightPanel.tsx:1953-1977; manual#relations"
trigger: "a relation is created without a relation type"
---
