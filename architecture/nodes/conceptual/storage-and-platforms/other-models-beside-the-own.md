---
id: "61a77806-33f2-4564-b46e-143a9ff5977a"
type: "requirement"
label: "Other models beside the own"
action: "it shall show them with the model's own, write only the model's own elements and relations back to the folder, and leave the other models' elements out of the branch's changes, the base and what is saved elsewhere (a file, the browser), and keep the places its views and layout hold of another model's elements when those are not fetched"
ears_type: "event-driven"
rationale: "The repository keeps only its own model, with references to the others by id; a copy of theirs in its folder would be one more thing to keep in step, and a change to it would be lost at the next fetch. Evidence: packages/common/src/model.ts (ownModel), packages/common/src/formats/mdFolder.ts (the serializer writes only the own model), packages/common/src/federation.ts (withOtherModels), apps/mcp/src/folderModel.ts (run), apps/studio/src/renderer/src/store/documentStore.ts (loadDocument)"
trigger: "Studio or the MCP server reads a model folder whose .radical/federation.json holds other models' elements"
---
