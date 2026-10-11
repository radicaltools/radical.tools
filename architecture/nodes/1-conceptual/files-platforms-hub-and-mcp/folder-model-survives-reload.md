---
id: "5534925e-b747-4723-8c17-718bb222f9f3"
type: "scenario"
label: "Folder model survives reload"
gherkin: |
  And the model is still listed as a folder-backed model
  # Covered by: apps/e2e/tests/studio/folders.spec.ts › a folder-backed model survives a reload
given: "the sample model is saved as a folder"
then: "the folder contains nodes/card-gateway/_index.md and the canvas shows Card Gateway after the reload"
when: "the user renames Payment Provider to Card Gateway and reloads the page"
---
