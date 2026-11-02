---
id: "f40bd02d-6e69-4f9b-9413-b090e5ec3da1"
type: "scenario"
label: "Checked with its dependencies"
given: "payments' model with a relation to an element of orders, pinned in deps.json"
metrics: "test(apps/cli/src/federation.test.ts › radical federation › radical check composes the dependencies and finds a reference to no element) passed"
then: "the check passes and names orders and its commit; after the removal the relation is the error rel-end-missing"
when: "radical check runs on it, then after the element is removed from orders and the pin moved"
---
