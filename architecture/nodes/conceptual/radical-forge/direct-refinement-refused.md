---
id: "bd08e9b1-6e67-4e9e-b547-d64f8f2c61ed"
type: "scenario"
label: "Direct refinement refused"
given: "a Processes stage open on a model with requirements and scenarios from earlier stages"
tests: "packages/common/tests/forgeProposals.test.ts › refinementGuard refuses writes to earlier stages and lets the stage write its own"
then: "its own writes pass; each write to an earlier stage is refused with a message that names propose_refinement"
when: "the stage adds a process and a step, links the process to an earlier requirement, updates a step it added, and also adds a requirement, updates, moves or deletes an earlier element, links two earlier elements and changes an element or link an accepted proposal added"
---
