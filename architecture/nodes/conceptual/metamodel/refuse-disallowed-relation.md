---
id: "c14edd18-a87d-41d2-9870-a407c7ce25e7"
type: "requirement"
label: "Refuse disallowed relation"
action: "Studio shall create no relation and show the notification \"Relation not allowed: <source type> → <target type>\"."
ears_type: "unwanted-behaviour"
rationale: "Relations the metamodel forbids would make the model invalid. Evidence: packages/ui/src/components/Canvas.tsx:607-624,644-652; packages/common/src/model.ts:210-215; packages/ui/src/store/diagramStore.ts:1825-1833; manual#relations"
unwanted_condition: "the metamodel does not allow a relation between the source and target types"
---
