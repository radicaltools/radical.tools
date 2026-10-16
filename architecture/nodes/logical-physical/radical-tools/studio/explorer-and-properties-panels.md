---
id: "08c445dd-e14d-47dd-b4b1-1776a539dcbc"
type: "component"
label: "Explorer and properties panels"
technology: "React (@radical/ui)"
---

packages/ui/src/components/RightPanel.tsx (LeftPanel and RightPanel), ViewPipelinePanel, StructurePanel, NodeWizard, EarsQuickEntry, RefPicker. On the left Views and Milestones, with + New view (a blank view or one of the metamodel's viewpoints) and the properties of a view (name, folder, lines, viewpoint, view type, layout and its Filter: a chain of levels with their filters, the order; read-only with Detach for a view of a viewpoint, Save as viewpoint otherwise) or a milestone; on the right Structure — what the active view shows, as a tree, a click opening an element's properties — and Sequences, and the properties of the selected element or relation (EARS editor, wireframe, Hub template section); the node-creation wizard. The Elements palette is part of the canvas (ElementPalette).
