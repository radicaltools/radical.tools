---
id: "f6b82d22-6341-4eb0-8f3a-a95faa19852f"
type: "scenario"
label: "Agent asks before each refinement"
given: "an MCP client running Forge whose requirements, domain model, fitness functions, scenarios and state machines stages are completed"
metrics: |
  test(apps/mcp/src/forge.test.ts › asks the user before each refinement, applies what they accept, and regenerate undoes it) passed
  test(apps/mcp/src/forge.test.ts › Radical Forge over MCP › leaves out of the stage's refinements what someone else changed while it ran) passed
  test(packages/common/tests/forgeRefinements.test.ts › acceptedRefinements) passed
then: "the direct writes are refused with a pointer to forge_propose_refinement; each forge_propose_refinement returns the proposal field by field (the action's old and new values) and writes nothing; forge_answer_refinement with accept applies the first whole, and with decline writes nothing and hands back the reply; forge_complete_stage reports the accepted refinements and not an edit someone else made meanwhile, and regenerating the stage takes the accepted ones back and leaves that edit"
when: "the Processes stage adds a process, then tries to add a requirement and to change an earlier requirement directly, then proposes a requirement with a scenario and a new action for the earlier requirement, which the user accepts, and another requirement, which the user declines with a reply; meanwhile another program renames an earlier requirement"
---
