---
id: "f6b82d22-6341-4eb0-8f3a-a95faa19852f"
type: "scenario"
label: "Agent asks before each refinement"
given: "an MCP client running Forge whose requirements, domain model, fitness functions, scenarios and state machines stages are completed"
tests: "apps/mcp/src/forge.test.ts › asks the user before each refinement, applies what they accept, and regenerate undoes it"
then: "the direct writes are refused with a pointer to forge_propose_refinement; each forge_propose_refinement returns the proposal field by field (the action's old and new values) and writes nothing; forge_answer_refinement with accept applies the first whole, and with decline writes nothing and hands back the reply; forge_complete_stage reports the accepted refinements, and regenerating the stage takes them back"
when: "the Processes stage adds a process, then tries to add a requirement and to change an earlier requirement directly, then proposes a requirement with a scenario and a new action for the earlier requirement, which the user accepts, and another requirement, which the user declines with a reply"
---
