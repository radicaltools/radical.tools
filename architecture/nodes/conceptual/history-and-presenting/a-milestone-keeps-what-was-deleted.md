---
id: "336124ff-ceee-40e1-bc8e-52d5b7fefb16"
type: "scenario"
label: "A milestone keeps what was deleted"
given: "a milestone that holds an element a view lists, and later milestones; an element with a view of its own in a group of views per element; and a sequence played on a flow view"
tests: |
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › is still drawn on a view that listed it when the milestone is shown, and not on the live view
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › is drawn in the milestone after a reload, and the live views stay without it
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › Undo of the delete leaves the milestone as it was
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › a delete made in a later milestone and propagated leaves it on the earlier one's view
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › Unwrap on the live model leaves it on the milestone's view too
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › deleted in a milestone that shows the view its own way and propagated, leaves the live view too
  packages/common/tests/modelFacade.test.ts › createModelFacade › removing a node a milestone holds leaves it on that milestone's view (delete_node, F-0053)
  packages/ui/tests/milestoneDeletedSince.test.ts › A view of one element deleted from the live model since a milestone (F-0064) › is in the group in the milestone and draws what the element holds; not on the live model, nor saved with its views
  packages/ui/tests/milestoneDeletedSince.test.ts › A view of one element deleted from the live model since a milestone (F-0064) › stays the milestone's alone after Undo of an edit in the milestone
  packages/ui/tests/milestoneDeletedSince.test.ts › A view of one element deleted from the live model since a milestone (F-0064) › is in the milestone after a reload, with its places
  packages/common/tests/modelFacade.test.ts › createModelFacade › removing the element of a view of one element keeps that view, with its places, in a milestone that holds it (delete_node, F-0064)
  packages/ui/tests/milestoneDeletedSince.test.ts › A sequence deleted from the live model since a milestone (F-0065) › still plays on its flow view in the milestone; the live view is unlinked, also saved
  packages/ui/tests/milestoneDeletedSince.test.ts › A sequence deleted from the live model since a milestone (F-0065) › deleted in a later milestone and propagated, it still plays on the earlier one
  packages/ui/tests/milestoneDeletedSince.test.ts › A sequence deleted from the live model since a milestone (F-0065) › Undo of the delete leaves the milestone as it was
  packages/common/tests/modelFacade.test.ts › createModelFacade › removing a sequence a milestone holds keeps its flow view linked there (delete_sequence, F-0065)
then: "the milestone's view still draws the element, after the reload too, while the live view does not; Undo leaves the milestone as it was; a delete propagated from a later milestone leaves it on the earlier one's view, and one made in a milestone that shows the view its own way leaves the live view too; the element's own view stays in its group in the milestone, with its places, drawing what the element holds, after Undo of an edit in the milestone and after a reload, and is neither on the live model nor saved with its views; the flow view still plays the sequence in the milestone, while the live view is unlinked, also once saved"
when: "the element is deleted from the live model (in Studio, by Unwrap, by delete_node), or in a later milestone and propagated, and the milestone is shown, also after a reload; and the delete is undone; the element with a view of its own is deleted the same ways; and the sequence is deleted (in Studio, by delete_sequence, or in a later milestone and propagated)"
---
