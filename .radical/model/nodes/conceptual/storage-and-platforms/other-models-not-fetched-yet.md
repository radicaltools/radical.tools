---
id: "11ced284-667c-4fdd-94b4-9fdc66ad32c7"
type: "scenario"
label: "Other models not fetched yet"
given: "payments' model folder with a deps.json and nothing fetched"
metrics: "test(apps/e2e/tests/studio/federation.spec.ts › a model whose other models are not fetched says how to fetch them) passed"
then: "Studio says that the model depends on orders, not fetched yet, and names radical federation fetch"
when: "Studio opens it"
---
