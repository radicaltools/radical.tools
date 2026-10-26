---
id: "a8e61526-07f9-4b52-8fc3-ccc72a0af7db"
type: "requirement"
label: "Per-view positions and camera"
action: "Studio shall save the element positions and camera of the outgoing view and restore those saved for the incoming view; keep each view's camera, and All elements', in this browser for the document, outside the model files, so a reload opens each view where it was; and leave the cameras out of Undo and Redo, so a step undone on another view keeps the cameras of both views."
ears_type: "complex"
precondition: "Studio is in the Designer perspective"
rationale: "Each view keeps its own arrangement, so arranging one diagram never disturbs another. An Undo that went back to another view put back the camera of the view left (round 185–192, 2026-10-26, F-0063), and since a reload saves nothing (D15) a camera moved on its own was lost on reload (F-0084); the cameras are kept per viewer, not in the model, so moving one changes no model file (not while a presentation plays, nor for an exploration). Evidence: packages/ui/src/store/diagramStore.ts (_restoreHistoryEntry, loadDiagram); packages/ui/src/store/viewCameras.ts; packages/ui/tests/views.test.ts:113-178; manual#views"
trigger: "the user switches to another view"
---
