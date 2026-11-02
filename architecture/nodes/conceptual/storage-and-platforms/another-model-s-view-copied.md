---
id: "3c856053-99bb-47f4-9ced-6a505309145b"
type: "scenario"
label: "Another model's view copied"
given: "Studio on payments' model with orders' view Containers fetched, and a view of payments named Containers"
metrics: |
  test(packages/common/tests/federation.test.ts › federation › copies another model's view into the model, named apart when the name is taken) passed
  test(apps/e2e/tests/studio/federation.spec.ts › another model's view is listed in its folder, read-only, and copied into the model) passed
then: "the copy is payments' own view named Containers (orders), editable, opened, saved in payments' views.json with orders' elements and places; orders' view stays as it was"
when: "the user opens orders › Containers, finds it read-only, and copies it into the model"
---
