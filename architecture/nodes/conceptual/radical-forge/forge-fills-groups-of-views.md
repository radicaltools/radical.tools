---
id: "8d1872cd-9f7d-466c-a04d-aa3256de5b50"
type: "scenario"
label: "Forge fills groups of views"
given: "a Forge run with the Radical structure as preselected, in a model with an external system"
metrics: "test(packages/common/tests/forgeViews.test.ts › radical structure › makes a group of views of each state machine, process, system, container and domain, which a later element joins) passed"
then: "the groups State machine, Process and Entities of a domain in Conceptual and Containers of a system and Components of a container in Logical each hold a view of each such element, named after it, none of the external system; the third machine joins its group as it is added and the stage reports its view; no view of the whole-model Containers, Components, Process (Warnier) or Domain model is made"
when: "its stages add two state machines, two processes, a system with two containers and two domains, and a later stage adds a third state machine"
---
