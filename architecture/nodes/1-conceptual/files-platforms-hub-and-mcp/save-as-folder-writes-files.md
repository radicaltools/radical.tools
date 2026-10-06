---
id: "9f12c30c-b067-4695-a67b-c7e0660ec9d5"
type: "scenario"
label: "Save as folder writes files"
gherkin: |
  And the Models dialog shows the model under Folders with a FOLDER badge
  And nodes/customer.md has the label in its front-matter and the description as its body
  # Covered by: apps/e2e/tests/studio/folders.spec.ts › save as folder writes one Markdown file per element
given: "the bookstore sample is open as a local model in a browser with folder access"
then: "the folder holds radical.md, one .md per element with systems and containers as directories with _index.md, relations.json and _layout.json"
when: "the user chooses Save as folder… in Manage models"
---
