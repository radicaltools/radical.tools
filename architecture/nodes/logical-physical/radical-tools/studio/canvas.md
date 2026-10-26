---
id: "15700a5d-75a0-4f03-be4f-78f596580088"
type: "component"
label: "Canvas"
technology: "ReactFlow 11 (@radical/ui)"
---

packages/ui/src/components/Canvas.tsx, ElementPalette.tsx, propertiesCover.ts, nodes/C4Nodes.tsx, edges/RelationEdge.tsx. The interactive editor for C4 and governance elements and their relations, with routed edges and mockup wireframes, and in Designer the Elements palette down its left side; its camera fits and frames in the part the palette and the properties card leave free. A process is a frame of its steps, a step a card that holds the steps inside it, with its repetition and condition under its name in Warnier–Orr notation ((0,1) under an alternative) and ⊕ or + in the header of one whose steps are a choice or concurrent (ProcessNode, StepNode); dashed arrows lead from each step to the next of a sequence (processFlow, drawn, not stored, not clickable). An element of a type with no drawing of its own, one made in the metamodel editor, is a card in its type's colours with the type's name, or a frame while it holds elements (GenericNode, React Flow's default node type). While find in the view is open, its hits and the containers they are in stay as drawn and the rest is dimmed (store/canvasFocus.ts, findFocus).
