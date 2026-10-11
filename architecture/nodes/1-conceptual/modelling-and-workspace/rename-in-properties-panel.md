---
id: "d8fc3e59-3cbd-4e5a-9d77-fbf343f005bc"
type: "scenario"
label: "Rename in properties panel"
gherkin: |
  And the stored model has the new label
  # Covered by: apps/e2e/tests/studio/editing.spec.ts › rename an element in the properties panel
given: "the bookstore System Context view"
then: "the node on the canvas reads Card Gateway"
when: "the user selects Payment Provider and changes its Label to \"Card Gateway\""
---
