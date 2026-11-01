---
id: "3027b577-5042-4975-a7cf-0aad08adb14f"
type: "component"
label: "Setup status"
technology: "Node.js"
---

apps/cli/src/status.ts (radical setup --status [folder], and the last step of radical setup). Reads the agents' configurations through CLIENTS (apps/cli/src/agentConfig.ts), as the Setup command writes them, finds the Radical MCP servers in them, checks each one's command and folder and pinned version, and starts each server configured for the folder as an MCP client over stdio (initialize, then get_model_summary) with a time limit. An entry through the Launcher is checked for the launcher file, and its pinned version read from the launcher's version line. ${workspaceFolder} is expanded as VS Code does before a server starts. For a model folder with a deps.json it lists each model it names with the version pinned and the commit fetched, and warns when nothing is fetched or deps.json pins another version than the one fetched.
