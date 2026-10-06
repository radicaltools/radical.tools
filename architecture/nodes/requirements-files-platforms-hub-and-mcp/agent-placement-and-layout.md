---
id: "1bc446a4-cd6e-469f-87d5-818b9758f268"
type: "scenario"
label: "Agent placement and layout"
gherkin: "# Covered by: apps/mcp/src/folderModel.test.ts › places children inside their parent, keeps defaultPositions in step and runs Smart Layout"
given: "an MCP server bound to a model folder"
then: "the children sit inside the domain, the domain grows to wrap them and the All elements positions match the node geometry after the layout"
when: "the agent adds two systems inside a domain, moves a third into it and then calls smart_layout"
---
