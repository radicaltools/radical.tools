---
id: "7622ecf5-5747-498f-b04f-91564c72028a"
type: "requirement"
label: "Merge concurrent writes"
action: "The system shall merge its change with the outside one element by element and field by field (relations, views, sequences, presentations and milestones by id, positions element by element), keep the outside value of a field both changed and name it, write the merged model, and refuse the write only when the folder does not read as a model."
ears_type: "unwanted-behaviour"
rationale: "Model files are edited in other editors, by git and by coding agents, often while Studio has the folder open; the two sides nearly always change different elements. Evidence: packages/common/src/modelMerge.ts (mergeModels), packages/common/src/formats/mdFolderSync.ts (MdFolderSession.write merge, mergeMdFolderFiles), apps/studio/src/main/index.ts, apps/studio/src/renderer/src/store/documentStore.ts, apps/mcp/src/folderModel.ts (commit)"
unwanted_condition: "a model file changed outside the app since the app read it"
---
