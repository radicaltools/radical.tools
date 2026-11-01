---
id: "44fbd164-6749-44bd-9c78-c4661649dd23"
type: "component"
label: "Diagram store"
technology: "Zustand + immer (@radical/ui)"
---

packages/ui/src/store/diagramStore.ts. The single source of truth for nodes, relations, views, sequences, metamodel, milestones, presentations, mode and undo/redo; derives the ReactFlow nodes and edges. Its diff overlay (marks and ghosts) shows a milestone's diff, the flash of outside changes, and the branch's changes (branch, showBranchChanges; a milestone takes the overlay over). Elements and relations of another model of a federation (with an origin) are refused every change but their place, with a notice naming the model, the Delete key's before its prompt; their canvas nodes carry the class rf-node-other-model. Shared with the Hub viewer, which starts it empty and read-only. Each view's camera, and All elements', is kept per viewer and per document in browser storage (packages/ui/src/store/viewCameras.ts), outside the model files. On another model's view (otherModelViewShown) the canvas and the views edit nothing (editsShownView, as in Viewer), and every action that changes a view is refused with viewRefusal by the guard after the store is made (VIEW_CHANGES); copyOtherModelView makes the model's own copy in one undo step and opens it.
