---
id: "96622e95-55e7-437a-853d-b14574f95b7e"
type: "scenario"
label: "A relation with the new holder goes"
given: "a container that uses a system, beside it, and a component in the container that uses the system too; and a requirement beside the system that satisfies it"
tests: |
  packages/common/tests/relationEndpoints.test.ts › a relation to what holds it › goes when an element moves into what it relates to, with those of what it holds
  apps/e2e/tests/studio/nesting.spec.ts › nesting an element removes its relations with its new container, with a warning
  packages/common/tests/relationEndpoints.test.ts › a governance relation to what holds it › may be drawn, stays when an element moves into what it relates to, and the structural ones do not
  packages/common/tests/viewPipeline.test.ts › linkCandidates and what the model accepts › the connect key offers a governance type between an element and what holds it, and no structural one
  packages/common/tests/aiToolCatalogue.test.ts › node tools › move_node keeps a governance relation with what then holds the element, and add_relation takes one there
  packages/ui/tests/connectNodes.test.ts › a relation drawn between an element and what holds it › is added when it is a governance one, and stays when the requirement is moved into the system
  packages/ui/tests/connectNodes.test.ts › a relation drawn between an element and what holds it › is refused, with the reason, when it is a structural one
then: "both relations with the system are gone, a warning names them, and the container with its component stands in the system; relations with elements that do not hold it stay; the requirement keeps satisfies in the system; between an element and what holds it the connect key offers a governance type and no structural one, a satisfies is added in Studio and over MCP, and a structural relation is refused with the reason"
when: "the user moves the container into the system, and the engine moves it there; the requirement is moved into the system, in Studio and with move_node; and a relation is drawn between an element and what holds it, with the connect key and add_relation"
---
