---
id: "c551182e-1107-4bb1-8f6e-89baa79e3077"
type: "scenario"
label: "Concurrent edits both kept"
given: "a model folder that Studio or the MCP server has read, and a model of its own"
tests: |
  packages/common/tests/modelMerge.test.ts › mergeModels
  packages/common/tests/modelMerge.test.ts › mergeModels: order and id lists
  packages/common/tests/modelMerge.test.ts › mergeModels: a sequence's steps and notes
  packages/common/tests/modelMerge.test.ts › mergeModels: milestones made on both sides
  packages/common/tests/mdFolderSync.test.ts › MdFolderSession › merges a write with an outside edit when given a merge, and refuses a folder it cannot read
  packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › lets two writers of one folder take turns, so neither loses the other's write
  packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › takes over a turn left by a process that is gone
  packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › takes over a lock file that names no turn once it is past being written, to read or to write
  apps/mcp/src/folderModel.test.ts › folder-backed MCP model › merges an edit made in the folder since the call started
  apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › merges edits not saved yet with an outside edit
then: "the folder holds both sides' changes; for the same field it keeps the other writer's value and the writer is told which field; an element or relation one side deleted and the other changed is deleted, and the notice names whose change was dropped; a relation one side drew to an element the other deleted, and a step one side added for a relation the other deleted, are dropped and named, so the folder, get_issues and the canvas agree; a step one side removed and the other changed the note of is reported as removed, the other's change dropped; an element added into a container the other side deleted brings the container back with its relations and places, with a notice; elements each side put on one view both stay on it, a view whose elements both sides took out stays empty, and a view of every element stays one against an add; ids removed from lists on both sides stay removed with no conflict; each note stays on its step; milestones made on both sides keep the order they were made in; a reorder of views made on one side stays (when both reordered, the other writer's order is kept and reported); a folder that does not read as a model is still refused; Studio, reloading while it has unsaved edits, shows them merged with the outside change and saves them"
when: "another writer changes the folder (adds an element, renames another, moves elements, puts an element on a view, reorders views, deletes an element or a relation, removes a step) and the first writer then writes its own changes (another element changed, the same element's other field, the same field, another element on the same view, the views reordered, a relation drawn to the deleted element, a step added for the deleted relation, the removed step's note changed)"
---
