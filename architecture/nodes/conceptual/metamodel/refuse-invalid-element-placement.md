---
id: "6bb4689a-3c89-4520-ba90-3139af1eed54"
type: "requirement"
label: "Refuse invalid element placement"
action: "Studio shall refuse the change, leave the model unchanged and show a notification naming the allowed parents or the reached maximum."
ears_type: "unwanted-behaviour"
rationale: "Refusing with an explanation keeps the model valid instead of drawing something the metamodel forbids. Evidence: packages/common/src/model.ts:101-113,124-133,146-162; packages/ui/src/components/Canvas.tsx:704-740; packages/ui/src/store/diagramStore.ts:1464-1470,1485-1494,1566-1573,2154-2166; packages/ui/tests/model.test.ts:71,248; manual#elements"
unwanted_condition: "a new, re-parented or retyped element would break the metamodel containment rules or exceed its type cardinality"
---
