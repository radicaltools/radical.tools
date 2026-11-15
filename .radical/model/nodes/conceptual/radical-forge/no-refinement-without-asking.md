---
id: "edeed462-51eb-4468-86e0-fdd29f88d70f"
type: "requirement"
label: "No refinement without asking"
action: "Radical Forge shall refuse the write, naming the stage that makes a node of that type, earlier or later (or that no stage makes it), and for a write to an earlier stage tell the AI to propose it with the proposal tool instead"
ears_type: "unwanted-behaviour"
rationale: "The prompt asks the stage to propose, but a model does not always follow its prompt; the refusal makes the user's say hold for every write. The stage's own elements (and links from them to earlier ones) are still written freely. Evidence: packages/common/src/ai/forge/proposals.ts (refinementGuard); apps/studio/src/renderer/src/ai/runner.ts (guard); apps/mcp/src/folderModel.ts and apps/mcp/src/forge.ts (guard while a stage is open). The refusal of a type a later stage makes called it an earlier stage's and asked for a refinement (F-0156, round 211–220)."
unwanted_condition: "the AI running a Forge stage adds a node of a type its stage does not make, or writes to an earlier stage directly: changes, moves or deletes an element that was there before the stage or came from a proposal, or links two such elements"
---
