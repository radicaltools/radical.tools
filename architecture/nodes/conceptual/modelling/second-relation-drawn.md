---
id: "d0c4fce7-6cf5-4b21-9390-4a0bd8e0b693"
type: "scenario"
label: "Second relation drawn"
given: "two elements on the Containers view are already joined by a relation"
tests: "apps/e2e/tests/studio/editing.spec.ts › a second relation between the same two elements is drawn and can be selected"
then: "the model holds the new relation and the canvas draws it as an edge of its own that can be selected"
when: "the user connects them again"
---
