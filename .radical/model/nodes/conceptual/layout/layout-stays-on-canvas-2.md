---
id: "65b0767b-6771-472a-9e97-f234586e0e3c"
type: "requirement"
label: "Layout stays on canvas"
action: "when another canvas was opened, not apply that layout to either canvas, leave the positions shown and saved for both as they were, and tell the user that the layout was not applied; when an outside write was reloaded on the same canvas, apply the layout to it, place an element the write added, or moved into another parent, as a new element, and leave out an element it deleted"
ears_type: "unwanted-behaviour"
rationale: "Opening another view during a Smart Layout run put the first canvas's positions on the other view's elements and saved them there. An agent's write reloaded while the layout computed counted as another model load, so the layout was dropped with a notice (exploratory runs 65 to 69, 2026-10-21, item 236). Evidence: apps/e2e/tests/studio/physics.spec.ts; packages/ui/src/store/diagramStore.ts (loadDiagram, runSmartLayout, runTreeLayout, layoutChangedMeanwhile, placeAddedDuringLayout)"
unwanted_condition: "the user opens another canvas, or a change written outside Studio (an agent's write) is reloaded, while Smart Layout or the tree layout is still computing a layout for the canvas shown before"
---
