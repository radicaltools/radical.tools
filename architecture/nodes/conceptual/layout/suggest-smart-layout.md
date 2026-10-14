---
id: "b7b10084-f9fc-4115-b67f-4f0b068608da"
type: "requirement"
label: "Suggest Smart Layout"
action: "leave every element where it is and suggest running Smart Layout in a notification"
ears_type: "event-driven"
rationale: "The live physics only moves what is dragged or added, so a diagram that was never laid out stays tangled unless the user is told how to arrange it. Evidence: apps/e2e/tests/studio/physics.spec.ts"
trigger: "a model opens on a canvas where more than a tenth of the elements overlap a sibling"
---
