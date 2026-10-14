---
id: "a6c4f120-c353-45e4-89af-2dc36d760158"
type: "scenario"
label: "Folder renamed and reordered"
given: "the bookstore sample with System Context in the folder C4/Context, or with System Context and Containers in the folders Context and Containers"
tests: |
  apps/e2e/tests/studio/views.spec.ts › views panel › a view moves into a folder from its properties, the folder opens, closes and is renamed
  apps/e2e/tests/studio/views.spec.ts › views panel › a folder moves up and down among the folders beside it
  packages/common/tests/viewFolders.test.ts › view folders › renames a folder, and its views and subfolders move along
  packages/common/tests/viewFolders.test.ts › view folders › moves a folder up or down among the folders beside it, with all its views
then: "\"a/b\" is refused with a note, Model is taken and lists Context / System Context; Containers comes first, Move down is off at the end, and Undo puts Context first again"
when: "the user renames C4 in its properties, first to \"a/b\", then to Model; or moves Containers up in its properties and undoes it"
---
