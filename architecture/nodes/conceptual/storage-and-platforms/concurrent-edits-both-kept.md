---
id: "c551182e-1107-4bb1-8f6e-89baa79e3077"
type: "scenario"
label: "Concurrent edits both kept"
gherkin: ""
given: "a model folder that Studio or the MCP server has read, and a model of its own"
tests: |
  packages/common/tests/modelMerge.test.ts › mergeModels
  packages/common/tests/mdFolderSync.test.ts › MdFolderSession › merges a write with an outside edit when given a merge, and refuses a folder it cannot read
  apps/mcp/src/folderModel.test.ts › folder-backed MCP model › merges an edit made in the folder since the call started
  apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › merges edits not saved yet with an outside edit
then: "the folder holds both sides' changes; for the same field it keeps the other writer's value and the writer is told which field; a folder that does not read as a model is still refused; Studio, reloading while it has unsaved edits, shows them merged with the outside change and saves them"
when: "another writer changes the folder (adds an element, renames another, moves elements) and the first writer then writes its own changes (another element changed, the same element's other field, the same field)"
---
