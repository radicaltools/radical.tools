---
id: "c3ddd6d9-b198-4152-b1ae-19c371217541"
type: "scenario"
label: "The other models are fetched"
given: "a git repository orders with a model, and a repository payments whose deps.json pins orders"
metrics: |
  test(apps/cli/src/federation.test.ts › radical federation › fetches the other models with their origin into .radical/federation.json) passed
  test(packages/common/tests/federation.test.ts › federation) passed
then: ".radical/federation.json holds Orders and its relation marked with origin orders@<commit>, payments' own files are unchanged, and radical check passes a relation from Payments to Orders"
when: "radical federation fetch runs on payments"
---
