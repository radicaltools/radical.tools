---
id: "27e4ea84-371b-4df4-981c-1d3d27bc9a01"
type: "scenario"
label: "Forbidden connection refused"
gherkin: "# Covered by: apps/e2e/tests/studio/editing.spec.ts › a connection the metamodel forbids is refused"
given: "the bookstore System Context view with a second Person added"
then: "the notification \"Relation not allowed: Person → Person\" appears and no relation is added"
when: "the user Alt-drags from Customer to the new Person"
---
