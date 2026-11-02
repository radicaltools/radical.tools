---
id: "911bbf4d-206f-49e7-91de-9e9e292c7b46"
type: "scenario"
label: "Pickers offer what is accepted"
given: "the bookstore with a wiki and a table view, an ADR dropped onto a system, a domain model with aggregate roots and their parts, and the sample model"
then: "no element is offered through a structural type to what holds it, and the ways read with one ellipsis; the ADR may constrain the system it was dropped onto, and what is linked already stays ticked; a root is offered as part of only the parts of no other aggregate; the removed element leaves the list and nothing is linked to it; every link offered over the sample is one the model accepts and Validation does not flag"
when: "the user opens Add or link… on API's page and under Bookstore in the table, the ADR's wizard, and Add or link on an aggregate root; an outside edit removes an element the open picker lists; and the engine lists the link candidates of every view and viewpoint of the sample"
---
