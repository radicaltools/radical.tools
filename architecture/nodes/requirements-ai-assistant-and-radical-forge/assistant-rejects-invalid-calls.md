---
id: "b7250ae8-f0ec-4f8f-bc21-f2502f710dba"
type: "requirement"
label: "Assistant rejects invalid calls"
action: "The AI assistant shall reject that call, leave the model unchanged for it, and return the reason to the model so it can correct itself."
ears_type: "unwanted-behaviour"
rationale: "AI output must not corrupt a model that hand edits keep valid. Evidence: packages/common/src/ai/tools/nodeTools.ts:87-117,159-172; packages/common/src/ai/tools/relationTools.ts:75-121; apps/studio/src/renderer/src/ai/runner.ts:233-251; manual#ai"
unwanted_condition: "an AI tool call would break the metamodel's parent, root, cardinality or relation-pair rules, or refers to an unknown id"
---
