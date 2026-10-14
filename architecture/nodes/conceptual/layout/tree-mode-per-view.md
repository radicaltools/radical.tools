---
id: "e7e34a02-c40d-4366-b4c6-0322b4249092"
type: "scenario"
label: "Tree mode per view"
given: "a view whose layout mode is Hierarchical nested tree"
tests: "apps/mcp/src/folderModel.test.ts › long Smart Layout runs › lays out a view set to \"Hierarchical nested tree\" as a tree, as Studio does"
then: "Tree Layout runs instead, and each container stands below the one it calls"
when: "Smart Layout is invoked on it through the MCP server"
---
