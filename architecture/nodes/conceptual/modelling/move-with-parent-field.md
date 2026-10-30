---
id: "c726cead-d627-4003-847d-5135db126279"
type: "scenario"
label: "Move with Parent field"
given: "a canvas shows Payment Provider beside Bookstore"
metrics: |
  test(apps/e2e/tests/studio/editing.spec.ts › the Parent field moves an element into its new parent, and offers no loop) passed
  test(apps/e2e/tests/studio/properties-card.spec.ts › the card's Parent lists only where the element can go) passed
  test(packages/common/tests/relationEndpoints.test.ts › the parent of an element) passed
  test(packages/ui/tests/reparentOnEveryCanvas.test.ts › Move to… a container) passed
  test(packages/ui/tests/reparentOnEveryCanvas.test.ts › a step outdented in the Warnier view › lies clear of its old parent on every canvas) passed
  test(packages/common/tests/modelFacade.test.ts › createModelFacade › moves a node in every view that keeps a place for it: inside the new parent there, or placed afresh) passed
then: "Payment Provider becomes a child of Bookstore and lies inside its frame, clear of what it holds, Bookstore growing and its neighbours making room, on every canvas; an element moved out lies clear of its old container; Bookstore's Parent field offers neither Bookstore nor what lies inside it, nor an external element or a type it may not sit in"
when: "the user picks Bookstore as Payment Provider's Parent, then opens Bookstore's Parent field"
---
