---
id: "240f55cb-67ba-43fc-8f2e-bb78f3086d52"
type: "scenario"
label: "Agent starts new model"
given: "a folder that is missing, empty but for dot entries, or holds other files"
metrics: "test(apps/mcp/src/folderModel.test.ts › starting a model) passed"
then: "a missing or empty folder becomes a new model with the chosen metamodel (Radical by default) and an emptied one starts over; a folder with other files is left alone with a hint, and an existing model keeps its metamodel"
when: "the MCP server opens it, with or without --metamodel c4, or the folder is emptied or deleted while the server runs"
---
