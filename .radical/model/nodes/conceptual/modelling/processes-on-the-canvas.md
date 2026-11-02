---
id: "9214f6c2-e5bf-4919-8fbf-045c470a0bdb"
type: "requirement"
label: "Processes on the canvas"
action: "the canvas shall draw a process as a frame that holds its steps, and a step as a card with its type, name, and its repetition and condition under the name in Warnier–Orr notation ((0,1) under an alternative), that holds the steps inside it, both marking a choice of their children with ⊕ and concurrent children with +, folding like other containers, and grow every frame around a step put inside another, up to the outermost"
ears_type: "state-driven"
precondition: "a process or a step is shown on a canvas"
rationale: "A process drawn as bare labels, its steps beside it rather than in it, reads as nothing; a step inside a step inside a process inside a system is nesting four deep. Evidence: packages/ui/src/components/nodes/C4Nodes.tsx (ProcessNode, StepNode), packages/common/src/c4.ts (CONTAINER_TYPES), packages/layout/src/liveColaEngine.ts (NESTING_TYPES), packages/ui/src/store/diagramStore.ts (fitParentToChildren refits up the tree), packages/ui/src/components/Canvas.tsx"
---
