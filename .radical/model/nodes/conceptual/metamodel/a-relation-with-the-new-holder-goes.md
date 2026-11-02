---
id: "96622e95-55e7-437a-853d-b14574f95b7e"
type: "scenario"
label: "A relation with the new holder goes"
given: "a container that uses a system, beside it, and a component in the container that uses the system too; and a requirement beside the system that satisfies it"
then: "both relations with the system are gone, a warning names them, and the container with its component stands in the system; relations with elements that do not hold it stay; the requirement keeps satisfies in the system; between an element and what holds it the connect key offers a governance type and no structural one, a satisfies is added in Studio and over MCP, and a structural relation is refused with the reason; Propagate leaves those relations out of that model, and a notice says so"
when: "the user moves the container into the system, and the engine moves it there; the requirement is moved into the system, in Studio and with move_node; and a relation is drawn between an element and what holds it, with the connect key and add_relation; and a nest and a relation made in a milestone are propagated into a later model where one end holds the other"
---
