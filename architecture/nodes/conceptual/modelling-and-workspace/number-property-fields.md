---
id: "8c256ff7-46c9-4675-ac3d-87d480f48fb6"
type: "scenario"
label: "Number property fields"
given: "a Replicas number property on containers and a Weight number property on relations"
tests: "apps/e2e/tests/studio/runs-13-24.spec.ts › a number property is a number field and saves a number, on elements and relations"
then: "both are number fields; 3 and 5 are saved as numbers and the emptied field removes the property"
when: "the user types 3 into an element's Replicas, empties it, and types 5 into a relation's Weight"
---
