---
id: "336124ff-ceee-40e1-bc8e-52d5b7fefb16"
type: "scenario"
label: "A milestone keeps what was deleted"
given: "a milestone that holds an element a view lists, and later milestones"
tests: |
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › is still drawn on a view that listed it when the milestone is shown, and not on the live view
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › is drawn in the milestone after a reload, and the live views stay without it
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › Undo of the delete leaves the milestone as it was
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › a delete made in a later milestone and propagated leaves it on the earlier one's view
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › Unwrap on the live model leaves it on the milestone's view too
  packages/ui/tests/milestoneDeletedSince.test.ts › An element deleted from the live model since a milestone › deleted in a milestone that shows the view its own way and propagated, leaves the live view too
  packages/common/tests/modelFacade.test.ts › createModelFacade › removing a node a milestone holds leaves it on that milestone's view (delete_node, F-0053)
then: "the milestone's view still draws the element, after the reload too, while the live view does not; Undo leaves the milestone as it was; a delete propagated from a later milestone leaves it on the earlier one's view, and one made in a milestone that shows the view its own way leaves the live view too"
when: "the element is deleted from the live model (in Studio, by Unwrap, by delete_node), or in a later milestone and propagated, and the milestone is shown, also after a reload; and the delete is undone"
---
