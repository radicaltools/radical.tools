---
id: "317d225b-a01a-425b-928f-698dc88f60b9"
type: "scenario"
label: "Edits stay the own model"
given: "payments' model folder with orders fetched into .radical/federation.json, open in Studio and over MCP"
metrics: |
  test(apps/mcp/src/folderModel.test.ts › federation › reads the other models from .radical/federation.json and writes only its own) passed
  test(apps/e2e/tests/studio/federation.spec.ts › edits stay the model's own, and a new fetch reaches the open model) passed
  test(packages/common/tests/federation.test.ts › federation › keeps the places of another model's elements where nothing was fetched) passed
then: "payments' folder gains the relation and the new name and no file of Orders; Studio shows Orders as fetched now and keeps the edit; the branch's changes list only payments' own"
when: "a relation from Payments to Orders is added, Payments is renamed, and a new fetch changes Orders"
---
