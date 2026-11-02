---
id: "05493507-b2f5-4692-a25e-d96d83dc5b21"
type: "scenario"
label: "Other models' views in their folders"
given: "payments depends on orders and billing, each with a view named Containers whose filter shows every container, and payments has containers of its own"
then: "the views are listed as orders › Containers and billing › Containers; orders' shows only orders' containers; the change is refused naming orders, and nothing of theirs is written into payments' folder"
when: "the other models are fetched and payments' model is read, and a change to orders' view is tried"
---
