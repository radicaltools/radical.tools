---
id: "3c856053-99bb-47f4-9ced-6a505309145b"
type: "scenario"
label: "Another model's view copied"
given: "Studio on payments' model with orders' view Containers fetched, and a view of payments named Containers"
then: "the copy is payments' own view named Containers (orders), editable, opened, saved in payments' views.json with orders' elements and places; orders' view stays as it was"
when: "the user opens orders › Containers, finds it read-only, and copies it into the model"
---
