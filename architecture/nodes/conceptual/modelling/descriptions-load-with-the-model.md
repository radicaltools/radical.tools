---
id: "9768f8de-c0bc-4b4a-8599-a97c1a96c41d"
type: "requirement"
label: "Descriptions load with the model"
action: "read every element's description into the model with the rest of its files, so the table's summaries, the wiki and Quick Search show and find them without the element being selected first."
ears_type: "event-driven"
rationale: "Studio reads every file of a folder model on open and on each outside edit anyway. Leaving the descriptions out of the loaded model until an element was selected saved nothing, and left the table's summaries, the wiki and the search without them; a Forge run over MCP, rewriting the folder, emptied them again on every reload. Evidence: apps/studio/src/renderer/src/store/documentStore.ts (readFolderModel)."
trigger: "Studio opens a folder model, or reloads it after an edit made outside"
---
