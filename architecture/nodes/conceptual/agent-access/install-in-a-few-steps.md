---
id: "fbf0bc24-f535-4e68-a459-47ee6f253a26"
type: "need"
label: "Install in a few steps"
kind: "stakeholder-note"
source: "Product owner, 2026-10-27"
---

"I'm thinking about how to make the installation easier... a sh script that guides you step by step? What do you recommend?"
Settled after the proposal: no shell script; a guided `radical setup` in the published CLI (npx @radicaltools/cli setup) that asks for the model folder and the agents, writes their MCP configuration and offers the git hooks, and `radical doctor`, which checks every link from Node to a server answering for the folder. A Claude Desktop extension (.mcpb) and a Claude Code plugin may follow.
Translated from Polish.
