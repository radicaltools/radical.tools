---
id: "72811e07-bb58-43e2-8705-42d16c5c0e10"
type: "requirement"
label: "Matrix cell selects relations"
action: "The matrix view shall select the relation, or list the relations to pick from when the cell holds several."
ears_type: "event-driven"
rationale: "The user needs to see which relations make up a dependency. Evidence: apps/studio/src/renderer/src/components/MatrixView.tsx:152-170, 290-340; manual#view-matrix"
trigger: "the user clicks a marked matrix cell"
---
