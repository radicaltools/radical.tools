---
id: "d2e9a43e-65b7-46cd-95e9-b7bd5575b83d"
type: "scenario"
label: "A milestone leaves the live layout alone"
given: "a model whose All elements has an element at x 300 and whose view has it at x 5000"
metrics: "test(packages/ui/tests/milestoneViewPositions.test.ts › milestones and view positions) passed"
then: "the milestone keeps x 300; the view shows x 5000 and keeps it, the live All elements keeps 300 while the milestone's All elements keeps where it was moved; after leaving the view shows 5000 and All elements 300; the rename reaches the live model, the view's positions do not"
when: "a milestone is made with the view open; it is shown, the element is moved on the view and on All elements, and the user moves between them; the milestone is left with the view open; an element is renamed in the milestone with the view open and the edit carried on"
---
