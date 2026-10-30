---
id: "5e7a13e2-3621-425f-837f-3e54ea24edfd"
type: "scenario"
label: "Wrap siblings into system"
gherkin: |
  And Wrap into… lists only types the metamodel allows there
  # Not covered by an automated test
given: "two sibling Containers selected inside a Software System"
metrics: |
  test(packages/ui/tests/undoSteps.test.ts › "Wrap into…" › is one undo step) passed
  test(packages/ui/tests/wrapMakesRoom.test.ts › leaves the new parent clear of the elements beside what it wraps) passed
  test(packages/ui/tests/wrapMakesRoom.test.ts › pushes a pinned neighbour clear too, and moves nothing out of its way) passed
  test(apps/e2e/tests/studio/editing.spec.ts › Wrap into… makes room for the new parent beside what it wraps, also after a reload) passed
  test(packages/ui/tests/physicsStands.test.ts › keeps API Gateway where it is drawn when it is wrapped into a group, hugged by it, and moves nothing beside it) passed
  test(packages/ui/tests/wrapMakesRoom.test.ts › keeps what it wraps where it is drawn, hugs it, and moves nothing it does not cover) passed
  test(apps/e2e/tests/studio/editing.spec.ts › Wrap into… leaves what it wraps where it is, hugged by the new parent, and moves nothing beside it) passed
  test(packages/ui/tests/wrapMakesRoom.test.ts › "Wrap into…" › on the other canvases (F-0047) › leaves a view that does not draw the new parent as it was) passed
  test(packages/ui/tests/wrapMakesRoom.test.ts › "Wrap into…" › on the other canvases (F-0047) › draws the new parent round what it wraps where a canvas has it, and moves nothing it does not cover) passed
  test(packages/layout/tests/geometry.test.ts › placeUnplaced › a new parent of what the canvas has places for ("Wrap into…" on another canvas, F-0047) › draws the wrapped elements where they were, the new parent round them, and moves nothing else) passed
  test(packages/layout/tests/geometry.test.ts › placeUnplaced › a new parent of what the canvas has places for ("Wrap into…" on another canvas, F-0047) › fits a new parent the view does not draw tightly round them) passed
then: "a new container of that type surrounds both and becomes the selection; on the other canvases that have the two it is drawn round them where they are, tightly on a view that does not draw it, which stays as it was, and nothing it does not cover moves"
when: "the user picks a container type under Wrap into…"
---
