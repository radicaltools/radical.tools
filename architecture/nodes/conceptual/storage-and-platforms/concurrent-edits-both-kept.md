---
id: "c551182e-1107-4bb1-8f6e-89baa79e3077"
type: "scenario"
label: "Concurrent edits both kept"
gherkin: ""
given: "a model folder that Studio or the MCP server has read, and a model of its own"
tests: |
  packages/common/tests/modelMerge.test.ts › mergeModels
  packages/common/tests/modelMerge.test.ts › mergeModels: order and id lists
  packages/common/tests/modelMerge.test.ts › mergeModels: a sequence's steps and notes
  packages/common/tests/mdFolderSync.test.ts › MdFolderSession › merges a write with an outside edit when given a merge, and refuses a folder it cannot read
  packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › lets two writers of one folder take turns, so neither loses the other's write
  packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › takes over a turn left by a process that is gone
  apps/mcp/src/folderModel.test.ts › folder-backed MCP model › merges an edit made in the folder since the call started
  apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › merges edits not saved yet with an outside edit
then: "the folder holds both sides' changes; for the same field it keeps the other writer's value and the writer is told which field; elements each side put on one view both stay on it, and a reorder of views made on one side stays (when both reordered, the other writer's order is kept and reported); a folder that does not read as a model is still refused; Studio, reloading while it has unsaved edits, shows them merged with the outside change and saves them"
when: "another writer changes the folder (adds an element, renames another, moves elements, puts an element on a view, reorders views) and the first writer then writes its own changes (another element changed, the same element's other field, the same field, another element on the same view, the views reordered)"
---
