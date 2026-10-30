---
id: "68c03b21-3bb8-4317-b771-07f0c9330714"
type: "scenario"
label: "Domain and state stages"
given: "a Radical model and a Forge run started from a description"
metrics: "test(apps/e2e/tests/studio/forge.spec.ts › Forge builds the domain model after the requirements and the state machines after the scenarios) passed"
then: "the steps Description, Requirements, Domain, Fitness, Scenarios, States, Mockups, C4 and Finish show in that order on one line; the domain and its entity are in a Domain view and in Conceptual; the state machine is in a States view that opens, its transition carries the BookCollected event shown as the edge label, and the stage prompt says that Given is the source state"
when: "the user generates the requirements, domain model, fitness functions and scenarios, and then the state machines"
---
