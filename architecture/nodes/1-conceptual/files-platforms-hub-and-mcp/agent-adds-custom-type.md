---
id: "1da9874e-1735-4ace-aeb0-775c3ec9f55c"
type: "scenario"
label: "Agent adds custom type"
gherkin: |
  And a risk node with a severity property can be added and linked
  # Covered by: apps/mcp/src/catalogueTools.test.ts › copies a built-in metamodel on the first edit, persists it and refreshes tool schemas
given: "an MCP server bound to a folder that uses the built-in metamodel"
then: "the metamodel is saved as c4-ddd-governance-custom, the reply says it was copied, and add_node now lists risk as a type"
when: "the agent upserts a new node type risk"
---
