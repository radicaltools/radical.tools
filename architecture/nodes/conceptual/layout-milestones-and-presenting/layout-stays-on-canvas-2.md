---
id: "65b0767b-6771-472a-9e97-f234586e0e3c"
type: "requirement"
label: "Layout stays on canvas"
action: "not apply that layout to either canvas, leave the positions shown and saved for both as they were, and tell the user that the layout was not applied"
ears_type: "unwanted-behaviour"
rationale: "Opening another view during a Smart Layout run put the first canvas's positions on the other view's elements and saved them there. Evidence: apps/e2e/tests/studio/physics.spec.ts"
unwanted_condition: "the user opens another canvas while Smart Layout is still computing a layout for the canvas shown before"
---
