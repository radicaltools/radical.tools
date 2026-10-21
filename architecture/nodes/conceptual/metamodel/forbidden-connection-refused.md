---
id: "27e4ea84-371b-4df4-981c-1d3d27bc9a01"
type: "scenario"
label: "Forbidden connection refused"
given: "the bookstore System Context view with a second Person added"
tests: "apps/e2e/tests/studio/editing.spec.ts › a connection the metamodel forbids is refused"
then: "the notification \"Relation not allowed: Database → Person\" appears and no relation is added"
when: "the user Alt-drags from the Orders DB to Customer"
---
