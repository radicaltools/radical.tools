---
id: "5e7115f7-0ff0-4c12-ab36-a55593dc4dee"
type: "scenario"
label: "Another model's views list its elements"
given: "payments depends on orders, whose table, wiki, Warnier view and matrix of every element show what their filter gives, and payments has elements of its own"
then: "each lists only orders' elements and those of the models orders depends on, none of payments'"
when: "orders' views are opened in payments' model"
---
