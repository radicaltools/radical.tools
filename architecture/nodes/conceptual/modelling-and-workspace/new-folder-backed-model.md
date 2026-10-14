---
id: "a3ec67d3-a8af-4b0b-a932-b167fe67dda7"
type: "scenario"
label: "New folder-backed model"
given: "the welcome screen is shown"
tests: "apps/e2e/tests/studio/folders.spec.ts › New model on the welcome screen can keep the model in a folder"
then: "an empty model opens, the folder gets a metamodel.json, the Models dialog marks it as folder-backed, and the next New model has In a folder preselected"
when: "the user chooses New model, picks In a folder and presses Choose folder and create"
---
