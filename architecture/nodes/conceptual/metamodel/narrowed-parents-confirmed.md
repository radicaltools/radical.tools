---
id: "3cf732fa-294b-459a-b3b6-89a1670ad853"
type: "scenario"
label: "Narrowed parents confirmed"
given: "a model with containers inside systems"
tests: |
  apps/e2e/tests/studio/metamodel-editor.spec.ts › narrowing a type's parents below what the model holds asks first, listing what it breaks
  apps/e2e/tests/studio/metamodel-editor.spec.ts › metamodel changes that leave the model against it ask first
  apps/mcp/src/folderModel.test.ts › metamodel changes over MCP › narrowed below what the model holds is written, with what it breaks
then: "Studio asks first, listing the containers the change breaks, and changes the metamodel only once confirmed; the MCP server writes the change and its result names what it breaks; the delete and Reset to C4 ask once, listing what they break, and Add relation type says which untyped relations it leaves without a type"
when: "the user takes System out of Container's allowed parents in the metamodel editor, and an agent makes the same change with upsert_node_type; the user deletes a relation type in use, resets the metamodel to the C4 preset, and adds a relation type with no pairs to a model with untyped relations"
---
