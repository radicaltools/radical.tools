---
id: "fcb62022-4527-4fc2-9bd8-30ac8645361a"
type: "scenario"
label: "MCP edit appears in browser"
gherkin: "# Covered by: apps/e2e/tests/studio/folders.spec.ts › an MCP model edit appears in the open browser canvas"
given: "the sample model is saved as a folder and open in the browser canvas"
then: "the canvas shows MCP Customer without a reload and the file nodes/mcp-customer.md keeps that label"
when: "an MCP client calls update_node to rename customer to MCP Customer and the changed files reach the folder"
---
