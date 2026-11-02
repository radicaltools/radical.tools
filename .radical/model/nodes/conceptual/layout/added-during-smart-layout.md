---
id: "e538d61e-ea51-4a1e-aa9a-ae25eb484f6a"
type: "requirement"
label: "Added during Smart Layout"
action: "Studio shall apply the layout and then place an added element as a new element, inside its parent and next to what it relates to with room made around it, and settle a moved one by the rule for moves (it keeps its place where that lies inside the new parent and clear of what is there, otherwise it goes beside its new siblings, the parent growing with room made around it), in the layout's undo step, leaving nothing overlapping and the same result after a reload"
ears_type: "event-driven"
rationale: "An element dropped while Smart Layout ran landed where the layout put nothing, on top of others. The maintainer decided on 2026-10-21 (D11, exploratory runs 45 to 64) that it is placed as a new element once the layout is applied, as one undo step. An element moved into another parent during the run was put back where the layout had it, outside its new parent (exploratory runs 65 to 69, 2026-10-21, item 240). Evidence: packages/ui/src/store/diagramStore.ts (placeAddedDuringLayout, runSmartLayout: parents recorded at the start)"
trigger: "an element is added to the canvas, or moved into another parent, by the user or an agent, while Smart Layout or the tree layout computes a layout for it"
---
