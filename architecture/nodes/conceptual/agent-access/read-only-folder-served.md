---
id: "221ccf50-c0bf-4223-b064-b892c938a42d"
type: "scenario"
label: "Read-only folder served"
given: "a model folder, .radical/ included, that the process may not write"
tests: "packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › reads a folder it may not write, .radical/ and all"
then: "the model is read without taking a write turn"
when: "the folder is read"
---
