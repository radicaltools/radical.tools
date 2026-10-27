---
id: "f63ccd29-d434-463f-a575-9b5e70b36653"
type: "adr"
label: "Guided setup in the CLI"
alternatives: "A shell script (install.sh) run with curl | sh: no Windows, JSON edited with sed or jq, a script to trust, and it needs Node for npx anyway. Documentation only: where people got stuck. A Claude Desktop extension first: solves the PATH problem for one agent only."
consequences: "Works wherever the MCP server does, Windows included, with no curl | sh to trust. The place and format of each agent's configuration is code to keep up to date (CLIENTS in apps/cli/src/agentConfig.ts). A Claude Desktop extension (.mcpb) or a Claude Code plugin can follow as one-click paths writing the same entry."
context: "Connecting an agent took several hand edits: a JSON entry per agent, in a file whose place differs by agent and platform, an absolute path to node for Claude Desktop, which does not see the shell's PATH, and the git hooks for Studio's Changes on branch. The product owner asked whether a shell script that guides step by step would help."
date: "2026-10-27"
decision: "Guide the installation with `radical setup` in the published CLI (npx @radicaltools/cli setup), and check it with `radical doctor`. Both are Node, in the package people already run: setup finds the agents installed, merges one entry into each configuration (JSON parsed and written back, a TOML section replaced), pins the MCP server to the CLI's version, and doctor starts each server as its agent would. Every question has an option, so the same command runs unattended."
status: "accepted"
---
