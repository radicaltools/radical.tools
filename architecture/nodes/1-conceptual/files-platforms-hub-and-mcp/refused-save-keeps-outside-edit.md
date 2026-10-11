---
id: "c551182e-1107-4bb1-8f6e-89baa79e3077"
type: "scenario"
label: "Refused save keeps outside edit"
gherkin: "# Covered by: apps/mcp/src/folderModel.test.ts › rejects a changed folder before writing"
given: "Studio has read a model folder and radical.md was then changed by another program"
then: "nothing is written, the result lists radical.md as a conflict and the outside edit stays on disk"
when: "Studio or the MCP server tries to write the folder"
---
