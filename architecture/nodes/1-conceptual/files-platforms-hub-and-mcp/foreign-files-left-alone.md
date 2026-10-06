---
id: "9e05bdd3-a2b0-453e-beb6-86cadd911627"
type: "scenario"
label: "Foreign files left alone"
gherkin: |
  And the prompt says the folder is not a Radical model folder
  # Covered by: apps/e2e/tests/studio/folders.spec.ts › files the model does not own are left alone
given: "a folder holding package.json and nodes/README.md but no model"
then: "the model's files are written and the Payment Provider file is removed, while package.json and nodes/README.md are unchanged"
when: "the user confirms the prompt to save the model into it and later deletes Payment Provider"
---
