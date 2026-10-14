---
id: "c59951a5-4667-4fd1-99ed-36505a595077"
type: "scenario"
label: "Undo an AI addition"
gherkin: "# Not covered by an automated test"
given: "the assistant has just added a node to the model"
tests: |
  packages/ui/tests/undo.test.ts › undo / redo › addNode → undo removes it; redo reapplies
  packages/ui/tests/undo.test.ts › clearModel (the AI reset) is undoable › undo brings back nodes, relations, views and sequences; milestones stay
then: "the added node is removed again"
when: "the user presses Cmd/Ctrl+Z"
---
