---
id: "1e13fc84-f4af-43e9-b8f8-2b1c71f06788"
type: "requirement"
label: "Statechart notation"
action: "The canvas shall draw a state machine as a frame headed with the entity it is the lifecycle of, a state with its entry, exit and do actions under its name, the child states of a parallel state as dashed regions, a final state as a bullseye, initial, history (H, H*) and choice pseudostates as a dot, a circle and a diamond, and label a transition without a label of its own event [guard] / actions ^raised with the events' current names."
ears_type: "ubiquitous"
rationale: "The usual statechart notation, so a machine reads without opening each transition. Evidence: packages/ui/src/components/nodes/C4Nodes.tsx (state machine, state and pseudostate nodes), packages/common/src/metamodel/statechart.ts (transitionLabel, relationDisplayLabel), packages/ui/src/store/diagramStore.ts."
---
