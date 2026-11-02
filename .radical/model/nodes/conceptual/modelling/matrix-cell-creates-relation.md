---
id: "e2ceb348-d253-4eeb-b276-804aa33e7777"
type: "requirement"
label: "Matrix cell creates relation"
action: "The matrix view shall create a relation from the row element to the column element."
ears_type: "complex"
precondition: "Studio is in the Designer perspective"
rationale: "Dependencies can be recorded directly where they are analysed. Evidence: apps/studio/src/renderer/src/components/MatrixView.tsx:170-182; manual#view-matrix"
trigger: "the user clicks an empty matrix cell"
---
