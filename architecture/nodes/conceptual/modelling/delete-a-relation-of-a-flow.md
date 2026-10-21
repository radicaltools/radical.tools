---
id: "7f78e276-54ef-433f-a328-1c60c877d33f"
type: "scenario"
label: "Delete a relation of a flow"
given: "a sequence whose steps follow a relation, one of them with a note, and an element whose relations other steps follow"
tests: |
  apps/e2e/tests/studio/editing.spec.ts › deleting a relation takes its steps out of the sequence, says so first, and Undo puts them back
  packages/ui/tests/sequences.test.ts › deleting what a sequence steps along (D4)
  packages/common/tests/aiSequenceTools.test.ts › deleting what a sequence steps along (D4)
then: "the Delete prompt says how many steps go; the relation's steps leave every sequence with their notes in the delete's undo step, and Undo puts them back; deleting the element takes out the steps of the relations it takes with it; the agent is told how many steps went"
when: "the user deletes the relation and presses Undo, the element is deleted, and an agent calls delete_relation and delete_node"
---
