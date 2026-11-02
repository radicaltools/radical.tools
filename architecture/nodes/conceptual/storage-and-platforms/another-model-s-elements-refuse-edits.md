---
id: "43d1ed3a-c1e5-4f24-89dd-15b6aaa31ade"
type: "scenario"
label: "Another model's elements refuse edits"
given: "a model with an element and a relation fetched from orders"
metrics: |
  test(packages/common/tests/federation.test.ts › elements of other models are read-only) passed
  test(apps/mcp/src/folderModel.test.ts › federation) passed
then: "each is refused with a message naming orders; a relation from this model to the element and a move on this model's view are allowed"
when: "a change, a rename, a move, a deletion and a child are tried on them, in the model operations and over MCP"
---
