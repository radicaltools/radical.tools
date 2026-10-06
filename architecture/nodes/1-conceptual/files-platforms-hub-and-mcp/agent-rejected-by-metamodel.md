---
id: "bcdd4139-494a-495d-abaa-d366a131a9a3"
type: "scenario"
label: "Agent rejected by metamodel"
gherkin: "# Covered by: apps/mcp/src/catalogueTools.test.ts › copies a built-in metamodel on the first edit, persists it and refreshes tool schemas"
given: "an MCP server bound to a model folder with the built-in governance metamodel"
then: "the call returns an error and the folder keeps its model"
when: "the agent tries to delete a node type that is still in use or a built-in relation type"
---
