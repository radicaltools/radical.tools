---
id: "b824bbda-689e-47da-9150-5b9fd21f61e1"
type: "scenario"
label: "Another model's folder is read-only"
given: "payments' model with orders' views fetched, in the folder orders and its subfolder orders/Logical"
metrics: |
  test(packages/common/tests/federation.test.ts › federation › keeps the views of the model's own out of another model's folders) passed
  test(apps/mcp/src/folderModel.test.ts › federation › refuses a view of the model's own in another model's folder) passed
  test(apps/e2e/tests/studio/federation.spec.ts › another model's folder is marked and read-only) passed
then: "each is refused, naming orders; the folders orders and orders/Logical are marked as orders' and read-only in the list of views; a view of payments in a folder of its own is made and moved as ever"
when: "a view of payments is made in orders/Logical, a view of payments is moved into orders, and the folder orders is renamed, in Studio and over MCP"
---
