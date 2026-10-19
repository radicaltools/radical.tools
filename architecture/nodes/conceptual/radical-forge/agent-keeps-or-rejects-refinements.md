---
id: "f6b82d22-6341-4eb0-8f3a-a95faa19852f"
type: "scenario"
label: "Agent keeps or rejects refinements"
given: "an MCP client running Forge whose requirements, domain model, fitness functions, scenarios and state machines stages are completed"
tests: "apps/mcp/src/forge.test.ts › lists what a stage refined in earlier stages, rejects the chosen refinements, and regenerate undoes the rest"
then: "forge_complete_stage lists the added requirement and scenario and the changed requirement as refinements and asks the user to keep or reject them; after the rejection the earlier requirement has its old action, the added ones stay, and regenerating the stage removes them"
when: "the Processes stage adds a process, a requirement it found missing and a scenario for it, and changes the action of an earlier requirement, then completes the stage and rejects the changed requirement with forge_reject_refinements"
---
