---
id: "a4870045-9c2a-4c6d-bb3a-15d9a5ef56b6"
type: "requirement"
label: "Stop after 12 rounds"
action: "The AI assistant shall stop the run and report that it stopped without a final answer."
ears_type: "unwanted-behaviour"
rationale: "A model stuck in a loop must not keep spending the user's tokens. Evidence: apps/studio/src/renderer/src/ai/runner.ts:115,163-167,255"
unwanted_condition: "the model is still making tool calls after 12 rounds"
---
