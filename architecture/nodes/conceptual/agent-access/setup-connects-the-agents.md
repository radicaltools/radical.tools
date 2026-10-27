---
id: "600f300b-d75d-4a71-86cf-cd3611f0cd92"
type: "requirement"
label: "Setup connects the agents"
action: "the CLI shall start a model in a missing or empty folder with the chosen metamodel and refuse a folder that holds other files and no radical.md; add an MCP server for that folder, pinned to the CLI's own version, to the configuration of each chosen agent (Claude Code's .mcp.json and VS Code's .vscode/mcp.json at the top of the repository, naming the folder by its path from there; Claude Desktop's, Cursor's and Codex's user configuration, naming npx by its absolute path with node's directory on PATH), keeping every other entry, backing up a user configuration before changing it, adding nothing a second time and asking before it replaces another server of the same name; add the hooks that save the folder's base in its git repository, asking in a terminal to start one in the working directory when there is none; and end with radical doctor's checks"
ears_type: "event-driven"
rationale: "Connecting an agent was where people got stuck: a JSON entry to write by hand in a place that differs per agent and platform, Claude Desktop not seeing the shell's PATH, a server of another version than the CLI. One command in the package people already run with npx works on macOS, Windows and Linux, where a shell script would not. Evidence: apps/cli/src/setup.ts, apps/cli/src/agentConfig.ts (CLIENTS), apps/cli/README.md (radical setup)"
trigger: "radical setup runs for a model folder"
---
