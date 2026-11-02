---
id: "3d9caeb2-ee6f-4d5e-81b3-c29b135b49aa"
type: "requirement"
label: "Matrix marks dependencies"
action: "The matrix view shall list the view's visible elements as rows and columns in containment order and mark each cell where at least one relation runs from the row element to the column element, showing the count when there are several."
ears_type: "ubiquitous"
rationale: "A dependency structure matrix shows coupling and cycles at a glance. Evidence: apps/studio/src/renderer/src/components/MatrixView.tsx:13-35, 81-135, 260-285; manual#view-matrix"
---
