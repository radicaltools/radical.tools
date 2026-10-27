---
id: "bdcfe019-e771-4c56-ba74-0ea611571502"
type: "component"
label: "Setup command"
technology: "Node.js"
---

apps/cli/src/setup.ts (radical setup [folder]). Five steps: Node; the model folder (a missing or empty one is started as the MCP server starts one); the agents (CLIENTS in apps/cli/src/agentConfig.ts: where each keeps its MCP servers and how an entry is written there; JSON is merged, Codex's TOML section replaced; npx named by a stable path on the PATH that leads to the running node); the git hooks (Hooks command); and the checks of Setup status. In a terminal it asks through Io.ask, each question with its default; otherwise it takes options and defaults. Outside a git repository it asks, in a terminal, to start one in the working directory before the hooks. Run through the Launcher (RADICAL_LAUNCHER set), it pins the launcher's version line to its own, makes radical.sh executable, and writes entries that start the server through the launcher.
