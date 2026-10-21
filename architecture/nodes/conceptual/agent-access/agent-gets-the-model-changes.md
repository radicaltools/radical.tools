---
id: "4223b126-672e-40a1-9941-8adcdaeeac9b"
type: "scenario"
label: "Agent gets the model changes"
given: "a model folder committed to git on main, to which an agent then adds a system, gives another a description and runs Smart Layout"
tests: |
  apps/mcp/src/folderModel.test.ts › get_changes
  packages/common/tests/modelChanges.test.ts › model changes › counts an empty text, an unticked box or an empty list as no value, as a reload of the folder does
  packages/common/tests/mdFolderPersistence.test.ts › md-folder persistence › writes no empty text, unticked box or empty list, unless the property's default would show instead
then: "it names the merge base with main, one element added and one changed with its old and new description, no layout change, and leaves the folder's files as they were; outside git and for the unknown ref it says why it cannot compare"
when: "the agent calls get_changes, without since and with an unknown ref"
---
