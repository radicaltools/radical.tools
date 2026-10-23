---
id: "5e7a13e2-3621-425f-837f-3e54ea24edfd"
type: "scenario"
label: "Wrap siblings into system"
gherkin: |
  And Wrap into… lists only types the metamodel allows there
  # Not covered by an automated test
given: "two sibling Containers selected inside a Software System"
tests: |
  packages/ui/tests/undoSteps.test.ts › "Wrap into…" › is one undo step
  packages/ui/tests/wrapMakesRoom.test.ts › leaves the new parent clear of the elements beside what it wraps
  packages/ui/tests/wrapMakesRoom.test.ts › pushes a pinned neighbour clear too, and moves nothing out of its way
  apps/e2e/tests/studio/editing.spec.ts › Wrap into… makes room for the new parent beside what it wraps, also after a reload
  packages/ui/tests/physicsStands.test.ts › keeps API Gateway where it is drawn when it is wrapped into a group, hugged by it, and moves nothing beside it
  packages/ui/tests/wrapMakesRoom.test.ts › keeps what it wraps where it is drawn, hugs it, and moves nothing it does not cover
  apps/e2e/tests/studio/editing.spec.ts › Wrap into… leaves what it wraps where it is, hugged by the new parent, and moves nothing beside it
then: "a new container of that type surrounds both and becomes the selection"
when: "the user picks a container type under Wrap into…"
---
