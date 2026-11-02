---
id: "cd074891-77a3-446a-b8db-fdd98d197855"
type: "scenario"
label: "Agent's Forge binds the pack"
given: "an agent running Radical Forge over MCP on a shop description"
metrics: "test(apps/mcp/src/forge.test.ts › concern packs in a Forge run › imports the picked packs whole in Requirements and binds them after C4) passed"
then: "the pack is in the model, unbound, right after the Requirements stage; the C4 stage's summary says it was bound to the web app; its ADR constrains the web app and radical check reports no concern-unbound"
when: "it picks the Authentication pack in the Requirements stage's clarify with the user's answers, generates the stages, and generates a C4 stage with a web app people use that links nothing to the pack"
---
