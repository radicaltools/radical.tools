---
id: "3455c057-c6fc-4091-b449-1590c415f8e8"
type: "scenario"
label: "The other models in the toolbar"
given: "payments' model folder with a deps.json naming orders and billing, orders fetched at the version pinned, billing pinned at v2 and fetched at v1, and stock fetched through orders"
then: "the button shows a warning with 1 problem; the list shows orders and billing with their pins and commits, stock indented via orders, and a warning that billing is pinned at v2 but v1 is fetched, with radical federation fetch to copy; clicking orders opens its folder of views; a model without a deps.json has no button"
when: "the user opens the button beside the model's name and clicks orders"
---
