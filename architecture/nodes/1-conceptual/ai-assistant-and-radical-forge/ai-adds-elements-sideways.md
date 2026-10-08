---
id: "0f3597bd-aba0-4ee0-ba01-d3cfb9873297"
type: "requirement"
label: "AI adds elements sideways"
action: "Studio shall place them in a block wider than tall, beside the elements the canvas already shows."
ears_type: "event-driven"
rationale: "Rows of four that restarted at the same spot every run grew the canvas downward and stacked one run on the previous. Evidence: packages/layout/src/geometry.ts (createBatchPlacer); packages/common/src/c4.ts (landscapeSlot); apps/studio/src/renderer/src/ai/runner.ts"
trigger: "the AI assistant or Radical Forge adds elements to the canvas on screen"
---
