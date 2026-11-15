---
id: "fab94c16-db16-4909-ba5c-e7c86f1e63eb"
type: "requirement"
label: "Finish waits for the open stage"
action: "The MCP server shall refuse the call and name what to do first (complete the stage with forge_complete_stage, or bring the user's answer with forge_answer_refinement), as forge_complete_stage does; a finished run shall guard no model write and its status show no stage generating or asking, and a stage generated after the finish shall put the run back to active. A stage never begun still finishes as not run."
ears_type: "unwanted-behaviour"
rationale: "forge_finish took a run with a stage still generating or a proposal waiting: the finished run went on refusing the agent's writes as that stage's guard, while its status still showed the stage generating (F-0156, round 211–220). The fixing group decided to refuse the call, as forge_complete_stage does; a stage never begun stays not run (F-0112). Evidence: apps/mcp/src/forge.ts (finish, generate); manual#mcp"
unwanted_condition: "an agent calls forge_finish while a stage is open (generated and not completed) or a proposed refinement waits for the user's answer"
---
