---
id: "44fbd164-6749-44bd-9c78-c4661649dd23"
type: "component"
label: "Diagram store"
technology: "Zustand + immer (@radical/ui)"
---

packages/ui/src/store/diagramStore.ts. The single source of truth for nodes, relations, views, sequences, metamodel, milestones, presentations, mode and undo/redo; derives the ReactFlow nodes and edges. Shared with the Hub viewer, which starts it empty and read-only.
