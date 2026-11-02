---
id: "62d956f4-be9c-47de-af45-9257a891cfa3"
type: "requirement"
label: "Matrix cell removes relation"
action: "The matrix view shall remove that relation from the model and name the removed relation in a notification."
ears_type: "complex"
precondition: "Studio is in the Designer perspective"
rationale: "The matrix both creates and removes dependencies (scenario Click a matrix cell). Evidence: apps/studio/src/renderer/src/components/MatrixView.tsx (onCellClick armedId, mx-popup-remove)."
trigger: "the user clicks the marked cell of a relation that is already selected, or the × beside a relation in a cell's list"
---
