---
id: "655e7dd1-1881-49a1-b6ae-7ccd67fc8b4b"
type: "scenario"
label: "New file-backed model"
given: "the welcome screen is shown"
tests: "apps/e2e/tests/studio/files.spec.ts › New model can keep the model in a file"
then: "an empty model opens, the file holds its nodes, relations and metamodel, and the next New model has In a file preselected"
when: "the user chooses New model, picks In a file and presses Choose file and create"
---
