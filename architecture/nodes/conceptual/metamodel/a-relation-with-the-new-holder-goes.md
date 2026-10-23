---
id: "96622e95-55e7-437a-853d-b14574f95b7e"
type: "scenario"
label: "A relation with the new holder goes"
given: "a container that uses a system, beside it, and a component in the container that uses the system too"
tests: |
  packages/common/tests/relationEndpoints.test.ts › a relation to what holds it › goes when an element moves into what it relates to, with those of what it holds
  apps/e2e/tests/studio/nesting.spec.ts › nesting an element removes its relations with its new container, with a warning
then: "both relations with the system are gone, a warning names them, and the container with its component stands in the system; relations with elements that do not hold it stay"
when: "the user moves the container into the system, and the engine moves it there"
---
