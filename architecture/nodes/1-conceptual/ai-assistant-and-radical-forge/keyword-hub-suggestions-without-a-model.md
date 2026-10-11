---
id: "6bd73b93-67ec-4e37-812e-817bc45e4c6a"
type: "requirement"
label: "Keyword Hub suggestions without a model"
action: "Radical Forge shall suggest the stage's best keyword matches from the Hub instead."
ears_type: "unwanted-behaviour"
rationale: "Hub suggestions must not depend on the model answering in the expected format. Evidence: packages/common/src/ai/forge/clarify.ts (parseClarifyReply); RadicalForgeModal.tsx (hubMatchesByStage)"
trigger: "AI is not configured or the model's clarify reply cannot be read"
---
