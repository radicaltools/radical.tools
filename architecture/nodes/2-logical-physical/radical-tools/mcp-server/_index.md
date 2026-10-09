---
id: "c681fcc0-29ea-49b4-827a-2b2db809a513"
type: "container"
label: "MCP server"
technology: "Node.js, MCP over stdio"
---

Local MCP server (apps/mcp) that gives coding agents one Markdown model folder as tools: summary with the modelling rules and the metamodel rules, search, the model's current issues (get_issues), add and move elements, views, sequences, presentations, milestones, metamodel edits, Smart Layout, and Radical Forge run with the agent's own model (forge_* tools and a forge prompt). Every write is validated against the metamodel: a new error refuses it, new warnings come back with the result.
