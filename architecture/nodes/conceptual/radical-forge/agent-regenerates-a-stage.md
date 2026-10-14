---
id: "2559ae3e-4e86-406e-a6ca-13f39ce289e2"
type: "requirement"
label: "Agent regenerates a stage"
action: "The MCP server shall remove what that stage added before handing out its task again, keeping the stage's earlier answers unless new ones are given."
ears_type: "event-driven"
rationale: "Same as Regenerate in the wizard: a second attempt replaces the first instead of stacking a copy. Evidence: apps/mcp/src/forge.ts (generate); packages/common/src/ai/forge/stageOutput.ts; apps/mcp/src/forge.test.ts"
trigger: "an agent asks for a Forge stage that has already run, with regenerate: true"
---
