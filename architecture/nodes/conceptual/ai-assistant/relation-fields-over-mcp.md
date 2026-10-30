---
id: "6e105358-ed25-489c-931f-d35768dcfcbb"
type: "scenario"
label: "Relation fields over MCP"
given: "a model with typed and untyped relations"
metrics: |
  test(packages/common/tests/aiDocumentTools.test.ts › add_relation with no type and a properties bag) passed
  test(packages/common/tests/aiDocumentTools.test.ts › update_relation types and properties) passed
  test(packages/common/tests/aiDocumentTools.test.ts › update_node label) passed
then: "the bag is checked against the type inferred for the pair and ignored where no single type fits; the new type drops the properties it lacks and says so; an empty type stores none, as Studio does; null clears the property; a blank label is refused as add_node refuses it, and a label given is trimmed"
when: "an agent adds a relation with no type and a properties bag, changes a relation's type, sends an empty type or a property as null, and gives update_node a blank label"
---
