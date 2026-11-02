---
id: "edeed462-51eb-4468-86e0-fdd29f88d70f"
type: "requirement"
label: "No refinement without asking"
action: "Radical Forge shall refuse the write and tell the AI to propose it with the proposal tool instead"
ears_type: "unwanted-behaviour"
rationale: "The prompt asks the stage to propose, but a model does not always follow its prompt; the refusal makes the user's say hold for every write. The stage's own elements (and links from them to earlier ones) are still written freely. Evidence: packages/common/src/ai/forge/proposals.ts (refinementGuard); apps/studio/src/renderer/src/ai/runner.ts (guard); apps/mcp/src/folderModel.ts and apps/mcp/src/forge.ts (guard while a stage is open)"
unwanted_condition: "the AI running a Forge stage writes to an earlier stage directly: adds a node of a type its stage does not make, changes, moves or deletes an element that was there before the stage or came from a proposal, or links two such elements"
---
