---
id: "a4a92be7-a50b-44ff-8cb1-e3f9e768a8d3"
type: "scenario"
label: "Another model's element in a table and the wiki"
given: "Studio on payments' model folder with Orders from the model orders"
metrics: "test(apps/e2e/tests/studio/federation.spec.ts › an element of another model is read-only in a table and the wiki) passed"
then: "the table row of Orders names orders, F2 opens no name field and it has no add row; its wiki page has no editable title or write line and its menu has no Delete; Payments is edited as ever"
when: "the user opens a table view and a wiki view of both and tries to rename Orders and add inside it"
---
