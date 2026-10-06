---
id: "15d27e46-8b0b-4513-96dc-cd989f3a295e"
type: "requirement"
label: "Tool calls edit model"
action: "The AI assistant shall carry out the tool calls the model makes against the open model, feed their results back, and repeat until the model replies without tool calls."
ears_type: "ubiquitous"
rationale: "Changes go through the same validated tool catalogue as MCP, not free-form JSON. Evidence: apps/studio/src/renderer/src/ai/runner.ts:113-253; packages/common/src/ai/tools/index.ts:26-71; manual#ai"
---
