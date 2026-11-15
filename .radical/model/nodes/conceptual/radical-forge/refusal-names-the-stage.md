---
id: "022fed80-e91d-446a-8c91-066da0d2859c"
type: "scenario"
label: "Refusal names the stage"
given: "Forge stages Domain model, Processes and Review open"
then: "each add is refused naming the stage that makes the type, earlier or later (of two, the nearer one), or that no Forge stage makes it; a later stage's type is not offered as a refinement"
when: "each adds a node of a type another stage makes (a requirement, a system, a mockup, a scenario, a container, an entity, a person) or an ADR, which no stage makes"
---
