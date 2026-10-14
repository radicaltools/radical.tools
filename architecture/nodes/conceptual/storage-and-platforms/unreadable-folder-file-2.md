---
id: "f66b560b-ae8f-4b2f-98d9-4cfbc75326fd"
type: "scenario"
label: "Unreadable folder file"
given: "a folder model open in Studio"
tests: |
  apps/studio/tests/mdFolderUnreadable.test.ts › a folder file that cannot be parsed
  apps/studio/tests/mdFolderUnreadable.test.ts › a node file with git conflict markers
then: "the user is told which file it is, the model on screen stays, nothing is written to the folder until the file reads again, and saving works again once it is fixed"
when: "relations.json gets a trailing comma, is cut short when the folder is opened, or a node file gets git conflict markers"
---
