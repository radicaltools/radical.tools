---
id: "a6c4f120-c353-45e4-89af-2dc36d760158"
type: "scenario"
label: "Folder renamed and reordered"
given: "the bookstore sample with System Context in the folder C4/Context, or with System Context and Containers in the folders Context and Containers"
then: "\"a/b\" is refused with a note, Model is taken and lists Context / System Context; Containers comes first, Move down is off at the end, and Undo puts Context first again"
when: "the user renames C4 in its properties, first to \"a/b\", then to Model; or moves Containers up in its properties and undoes it"
---
