---
id: "2ebcef88-15f7-4946-af3e-fc70d5e13c58"
type: "requirement"
label: "New folder starts a model"
action: "create the folder when it is missing and write a new empty model into it with the metamodel --metamodel names (radical by default, or c4), as Studio's Save as folder writes one, also when the folder is emptied or deleted while the server runs"
ears_type: "event-driven"
rationale: "An agent can start modelling in a fresh folder without Studio, and a user can start over by emptying the folder. Only a folder holding nothing but dot entries (.git, .DS_Store, .radical) counts as empty; one with other files and no manifest is still refused. Evidence: apps/mcp/src/folderModel.ts (startIfEmpty, FolderModel.open, run), apps/mcp/src/index.ts (USAGE), apps/mcp/src/folderModel.test.ts › starting a model"
trigger: "the MCP server opens, or is called on, a model folder that is missing or holds nothing but dot entries"
---
