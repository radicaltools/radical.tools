---
id: "e538d61e-ea51-4a1e-aa9a-ae25eb484f6a"
type: "requirement"
label: "Added during Smart Layout"
action: "Studio shall apply the layout and then place the element as a new element, inside its parent and next to what it relates to with room made around it, in the layout's undo step"
ears_type: "event-driven"
rationale: "An element dropped while Smart Layout ran landed where the layout put nothing, on top of others. The maintainer decided on 2026-10-21 (D11, exploratory runs 45 to 64) that it is placed as a new element once the layout is applied, as one undo step. Evidence: packages/ui/src/store/diagramStore.ts (placeAddedDuringLayout)"
trigger: "an element is added to the canvas, by the user or an agent, while Smart Layout computes a layout for it"
---
