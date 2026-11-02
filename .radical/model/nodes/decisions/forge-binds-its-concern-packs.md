---
id: "d41a16fb-f576-4e58-9674-da664e892968"
type: "fitness-fn"
label: "Forge binds its concern packs"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

apps/mcp/src/forge.test.ts runs a Forge over MCP with the agent picking a concern pack in Requirements, generating every stage and a C4 stage that links nothing, then checks the model with the pack.

Threshold: After the C4 stage every pack decision Forge imported constrains at least one element, and radical check reports no concern-unbound for it
