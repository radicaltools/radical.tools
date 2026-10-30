---
id: "d41a16fb-f576-4e58-9674-da664e892968"
type: "fitness-fn"
label: "Forge binds its concern packs"
category: "structural"
metrics: "test(apps/mcp/src/forge.test.ts › concern packs in a Forge run › imports the picked packs whole in Requirements and binds them after C4) passed"
---

apps/mcp/src/forge.test.ts runs a Forge over MCP with the agent picking a concern pack in Requirements, generating every stage and a C4 stage that links nothing, then checks the model with the pack.

Threshold: After the C4 stage every pack decision Forge imported constrains at least one element, and radical check reports no concern-unbound for it
