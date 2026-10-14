---
id: "326d27b6-b059-4345-a560-bd6844f6d5a9"
type: "requirement"
label: "Expand from the centre"
action: "grow the container around the centre of its collapsed box"
ears_type: "event-driven"
rationale: "Growing from the collapsed box's top-left corner ran the container right and down by half its size, away from where the user was looking. Evidence: apps/e2e/tests/studio/physics.spec.ts"
trigger: "the user expands a collapsed container on a canvas"
---
