---
id: "88b133fe-0642-471d-b6aa-dc3a8fdd45f0"
type: "requirement"
label: "Custom types on the canvas"
action: "the canvas shall draw it as a card in its type's colours with the type's name, its name and its description, and as a frame when it holds elements"
ears_type: "state-driven"
precondition: "an element of a type the canvas has no drawing of its own for is shown, such as a type added in the metamodel editor"
rationale: "A type made in the metamodel editor was drawn by React Flow's default node, a bare label. Evidence: packages/ui/src/components/nodes/C4Nodes.tsx (GenericNode), packages/ui/src/components/Canvas.tsx (the default node type)"
---
