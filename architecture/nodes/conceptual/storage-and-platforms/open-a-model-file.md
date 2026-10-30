---
id: "1efa9dc2-0177-4f4c-9587-1c7cff22dafb"
type: "scenario"
label: "Open a model file"
given: "a model file is on disk and the welcome screen is shown"
metrics: "test(apps/e2e/tests/studio/files.spec.ts › Open → File… keeps the model in the file and saves changes to it) passed"
then: "the new name is saved into the file, the model opens again from the file with the new name, and the Models dialog marks it as file-backed"
when: "the user chooses Open → File…, renames an element, and later reopens the model from the recent list"
---
