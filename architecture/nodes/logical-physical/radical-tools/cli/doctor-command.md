---
id: "3027b577-5042-4975-a7cf-0aad08adb14f"
type: "component"
label: "Doctor command"
technology: "Node.js"
---

apps/cli/src/doctor.ts (radical doctor [folder]). Reads the agents' configurations through CLIENTS (apps/cli/src/agentConfig.ts), as the Setup command writes them, finds the Radical MCP servers in them, checks each one's command and folder and pinned version, and starts each server configured for the folder as an MCP client over stdio (initialize, then get_model_summary) with a time limit.
