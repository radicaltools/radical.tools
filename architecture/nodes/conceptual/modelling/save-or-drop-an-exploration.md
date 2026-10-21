---
id: "79e13992-175f-4044-8f62-d5aa4d920be3"
type: "scenario"
label: "Save or drop an exploration"
given: "an explore view of API grown by one +"
tests: |
  packages/ui/tests/exploreView.test.ts › saving and closing an explore view
  apps/e2e/tests/studio/explore.spec.ts › an exploration is saved as a view, and dropped when closed
then: "a structure view \"API context\" in folder Explorations lists the elements shown with their places, Undo removes it and Redo brings it back; a closed or replaced exploration is gone without a question and the document is as it was"
when: "the user saves it as \"API context\" in folder \"Explorations\", undoes and redoes; and in another exploration closes it, starts a new one, or opens another model"
---
