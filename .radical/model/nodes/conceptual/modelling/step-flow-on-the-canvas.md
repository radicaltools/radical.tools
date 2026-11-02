---
id: "24e7f236-9c77-4dd3-8b31-5ba4abe09e8a"
type: "requirement"
label: "Step flow on the canvas"
action: "the canvas shall draw a dashed arrow from the one to the next, by their order, and none between the children of a choice or of a concurrent step, without storing it in the model and without moving anything"
ears_type: "state-driven"
precondition: "two steps that follow each other in a sequence are shown on a canvas"
rationale: "On a canvas the order of steps is otherwise only their numbers; the arrows follow it, and every edit of the order redraws them. The layout of a process is the Warnier view's; the canvas keeps where its steps were put. Evidence: packages/common/src/warnier.ts (processFlow), packages/ui/src/store/diagramStore.ts (deriveRFEdges), packages/ui/src/components/edges/RelationEdge.tsx"
---
