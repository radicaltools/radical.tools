---
id: "bc9ad026-86ec-4394-a51e-2983c2bae44f"
type: "scenario"
label: "Declined prompt changes nothing"
gherkin: "# Covered by: apps/e2e/tests/studio/folders.spec.ts › declining the prompt leaves a non-model folder untouched"
given: "a folder holding only nodes/README.md"
then: "the folder still holds only nodes/README.md and the model stays a local model"
when: "the user chooses Save as folder… and dismisses the confirmation"
---
