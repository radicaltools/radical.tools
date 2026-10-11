---
id: "346891e2-5bc3-44c8-8520-8d7142b412a6"
type: "requirement"
label: "Dragged element stays put"
action: "The live layout shall pin the dragged element, or every element inside a dragged container, to the pointer and move only the others."
ears_type: "state-driven"
precondition: "the user is dragging an element"
rationale: "Physics must never fight the user over the box they are holding. Evidence: packages/ui/src/layout/liveColaLayout.ts:164-273, packages/ui/src/layout/liveColaLayout.ts:606-612; packages/ui/src/store/diagramStore.ts:3076-3092; manual#layout"
---
