---
id: "3cf732fa-294b-459a-b3b6-89a1670ad853"
type: "scenario"
label: "Narrowed parents confirmed"
given: "a model with containers inside systems"
tests: |
  apps/e2e/tests/studio/metamodel-editor.spec.ts › narrowing a type's parents below what the model holds asks first, listing what it breaks
  apps/mcp/src/folderModel.test.ts › metamodel changes over MCP › narrowed below what the model holds is written, with what it breaks
then: "Studio asks first, listing the containers the change breaks, and changes the metamodel only once confirmed; the MCP server writes the change and its result names what it breaks"
when: "the user takes System out of Container's allowed parents in the metamodel editor, and an agent makes the same change with upsert_node_type"
---
