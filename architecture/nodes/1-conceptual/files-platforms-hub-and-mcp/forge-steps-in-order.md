---
id: "85c9c23a-cc90-45c5-9d25-861142754df4"
type: "requirement"
label: "Forge steps in order"
action: "The MCP server shall refuse the call and name the step to take first."
ears_type: "unwanted-behaviour"
rationale: "The wizard only moves forward through its stepper; an agent gets the same order spelled out. Evidence: apps/mcp/src/forge.ts (blocked); apps/mcp/src/forge.test.ts"
unwanted_condition: "an agent asks for a Forge stage before the earlier stages are completed, while another stage is still open, or without clarifying it first"
---
