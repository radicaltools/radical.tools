---
id: "1ef2a119-58f4-4c6e-8cd2-fd7793928bc0"
type: "scenario"
label: "Agent edits metamodel types"
given: "a model with the built-in Radical metamodel"
then: "the type is added and only the given fields change, a property's visibleWhen is kept whether sent or left out, and each bad input is refused with its reason, leaving the metamodel as it was"
when: "an agent adds a node type, changes only its colour or description, sets and clears how a relation type reads, and sends bad ids, unknown parents or pairs, an enum without options or a property keyed like a built-in field"
---
