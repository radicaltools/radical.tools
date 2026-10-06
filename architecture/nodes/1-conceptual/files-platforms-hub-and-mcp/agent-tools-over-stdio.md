---
id: "5d8729f7-0353-4058-9825-76ea0a638dfc"
type: "scenario"
label: "Agent tools over stdio"
gherkin: |
  And notes.txt and nodes/README.md are unchanged
  # Covered by: apps/mcp/src/folderModel.test.ts › lists and calls tools over stdio, persisting a real node ID
given: "an MCP client connected over stdio to a model folder that also holds notes.txt and nodes/README.md"
then: "the tool list has add_node but not reset_diagram, the summary carries ears_type and allowedPairs, and every change is in the folder with the real node id"
when: "the client lists tools, calls get_model_summary and adds, relates, renames and moves elements and creates a view"
---
