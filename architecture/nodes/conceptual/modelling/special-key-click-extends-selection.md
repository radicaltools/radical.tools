---
id: "38028fc1-8689-48aa-819e-8561038a0a4c"
type: "requirement"
label: "Special-key click extends selection"
action: "the canvas shall add the node to the current selection, or take it out where it is in it; a drag over the empty canvas shall select what its box covers."
ears_type: "event-driven"
rationale: "Multi-selection is the entry point for bulk wrap, move, hide and delete. Evidence: packages/ui/src/components/Canvas.tsx:539-554,953; packages/ui/src/store/diagramStore.ts:2571-2610; manual#selection"
trigger: "the user clicks a node with the special key held, without dragging, or drags over the empty canvas with it held"
---
