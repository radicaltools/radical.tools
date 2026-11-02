---
id: "b5992981-7b2f-4f91-bbde-b3d0f6dc1799"
type: "scenario"
label: "Another model's element in Studio"
given: "payments' model folder with Orders fetched from the model orders, open in Studio"
metrics: "test(apps/e2e/tests/studio/federation.spec.ts › an element of another model is marked and cannot be changed) passed"
then: "Orders has a dashed outline, its card says it comes from orders and is read-only and has no name field to edit, and the deletion is refused with a notice naming orders"
when: "the user selects Orders and presses Delete"
---
