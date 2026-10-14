---
id: "1ef2a119-58f4-4c6e-8cd2-fd7793928bc0"
type: "scenario"
label: "Agent edits metamodel types"
given: "a model with the built-in Radical metamodel"
tests: |
  packages/common/tests/aiDocumentTools.test.ts › metamodel tools › copy a preset on the first edit, and the copy survives reloading
  packages/common/tests/aiDocumentTools.test.ts › metamodel tools › refuse bad input, built-in deletes and types still in use
  packages/common/tests/aiDocumentTools.test.ts › metamodel tools › refuse a property keyed like a field every element or relation has
  packages/common/tests/aiDocumentTools.test.ts › metamodel tools › describe a new type, without inheriting the description of its base type
  packages/common/tests/aiDocumentTools.test.ts › metamodel tools › set and clear how a relation type reads from either end
then: "the type is added and only the given fields change, and each bad input is refused with its reason, leaving the metamodel as it was"
when: "an agent adds a node type, changes only its colour or description, sets and clears how a relation type reads, and sends bad ids, unknown parents or pairs, an enum without options or a property keyed like a built-in field"
---
