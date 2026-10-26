---
id: "44fbd164-6749-44bd-9c78-c4661649dd23"
type: "component"
label: "Diagram store"
technology: "Zustand + immer (@radical/ui)"
---

packages/ui/src/store/diagramStore.ts. The single source of truth for nodes, relations, views, sequences, metamodel, milestones, presentations, mode and undo/redo; derives the ReactFlow nodes and edges. Its diff overlay (marks and ghosts) shows a milestone's diff, the flash of outside changes, and the branch's changes (branch, showBranchChanges; a milestone takes the overlay over). Shared with the Hub viewer, which starts it empty and read-only. Each view's camera, and All elements', is kept per viewer and per document in browser storage (packages/ui/src/store/viewCameras.ts), outside the model files.
