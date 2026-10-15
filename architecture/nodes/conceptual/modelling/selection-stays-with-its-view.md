---
id: "9da0cb27-d169-47e6-950a-ffad2d9e0741"
type: "scenario"
label: "Selection stays with its view"
given: "the sample model with Accounts Service selected on All elements"
tests: |
  apps/e2e/tests/studio/selection-focus.spec.ts › each view keeps its own selection
  packages/ui/tests/viewSelection.test.ts › each view keeps its own selection
  packages/ui/tests/viewSelection.test.ts › a selected relation is kept per view too
  packages/ui/tests/viewSelection.test.ts › a selection survives the canvas being rebuilt
  packages/ui/tests/viewSelection.test.ts › reading the same document again keeps every view's selection
then: "Core Banking shows nothing selected and nothing dimmed; back on All elements Accounts Service is selected again with its focus; each view gets back its own selection, ring included, also after the document is read again and after the canvas is rebuilt"
when: "the user opens Core Banking, which shows Accounts Service too, and goes back to All elements; and in a model with two views, selects on each and the document is read again"
---
