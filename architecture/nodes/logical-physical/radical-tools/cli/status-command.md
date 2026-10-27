---
id: "3027b577-5042-4975-a7cf-0aad08adb14f"
type: "component"
label: "Status command"
technology: "Node.js"
---

apps/cli/src/status.ts (radical status [folder]). Reads the agents' configurations through CLIENTS (apps/cli/src/agentConfig.ts), as the Setup command writes them, finds the Radical MCP servers in them, checks each one's command and folder and pinned version, and starts each server configured for the folder as an MCP client over stdio (initialize, then get_model_summary) with a time limit. An entry through the Launcher is checked for the launcher file, and its pinned version read from the launcher's version line. ${workspaceFolder} is expanded as VS Code does before a server starts.
