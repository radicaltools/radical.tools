---
id: "317d225b-a01a-425b-928f-698dc88f60b9"
type: "scenario"
label: "Edits stay the own model"
given: "payments' model folder with orders fetched into .state/federation.json, open in Studio and over MCP"
then: "payments' folder gains the relation and the new name and no file of Orders; Studio shows Orders as fetched now and keeps the edit; the branch's changes list only payments' own"
when: "a relation from Payments to Orders is added, Payments is renamed, and a new fetch changes Orders"
---
