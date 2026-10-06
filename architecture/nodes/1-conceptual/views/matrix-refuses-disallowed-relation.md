---
id: "d66317a3-197f-4570-886a-0ff6cef848a3"
type: "requirement"
label: "Matrix refuses disallowed relation"
action: "The matrix view shall not create the relation and shall show a 'Relation not allowed' error."
ears_type: "unwanted-behaviour"
rationale: "The matrix must not bypass the metamodel rules every other editor enforces. Evidence: apps/studio/src/renderer/src/components/MatrixView.tsx:173-178; manual#view-matrix"
unwanted_condition: "the metamodel does not allow a relation between the row and column element types"
---
