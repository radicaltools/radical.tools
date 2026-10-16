---
id: "9da0cb27-d169-47e6-950a-ffad2d9e0741"
type: "scenario"
label: "Selection cleared on leaving a view"
given: "the sample model with Accounts Service selected on All elements"
tests: |
  apps/e2e/tests/studio/selection-focus.spec.ts › leaving a view clears its selection
  packages/ui/tests/viewSelection.test.ts › leaving a view clears its selection
  packages/ui/tests/viewSelection.test.ts › a selected relation is cleared too
  packages/ui/tests/viewSelection.test.ts › a selection survives the canvas being rebuilt
  packages/ui/tests/viewSelection.test.ts › reading the same document again keeps the open view's selection
then: "Core Banking shows nothing selected, nothing dimmed and no properties card; back on All elements nothing is selected either; a selected relation goes too; a selection stays when the canvas is rebuilt and when the document is read again while its view is open"
when: "the user opens Core Banking, which shows Accounts Service too, and goes back to All elements; and in a model with two views, selects on each, and the document is read again"
---
