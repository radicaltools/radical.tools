---
id: "fbf0bc24-f535-4e68-a459-47ee6f253a26"
type: "need"
label: "Install in a few steps"
kind: "stakeholder-note"
source: "Product owner, 2026-10-27"
---

"I'm thinking about how to make the installation easier... a sh script that guides you step by step? What do you recommend?"
Settled after the proposal: no shell script; a guided `radical setup` in the published CLI (npx @radicaltools/cli setup) that asks for the model folder and the agents, writes their MCP configuration and offers the git hooks, and `radical setup --status`, which checks every link from Node to a server answering for the folder. A Claude Desktop extension (.mcpb) and a Claude Code plugin may follow.
Then: "OK, I want a scenario: I create a folder, go into it, and run radical.sh setup or radical.cmd setup." Settled: two small launchers on radical.tools, radical.sh and radical.cmd, that find Node.js or download it and run the CLI; the steps stay in radical setup, which also offers to start a git repository in a new folder.
Later the product owner had `radical doctor` renamed, then moved under setup: `radical setup --status`.
Translated from Polish.
