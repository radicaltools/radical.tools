---
id: "049ee8fe-9cfa-4a0c-95a9-6f0cf2d27b1c"
type: "scenario"
label: "A new element fits where it is offered"
given: "a domain model with an aggregate root and a part, a system holding containers, and a filter that leaves out a choice's default"
then: "a part is offered under an aggregate root and added Kind entity, linked to it; none is offered under a part, nor a container by a relation to the system that would hold it; a choice whose default the filter leaves out gets another of its options; a node whose link the rules refuse is not added, and the reason is shown"
when: "the user adds an element under another in the table or writes one on a wiki page, and the engine lists what each place offers"
---
