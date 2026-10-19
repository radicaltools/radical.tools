---
id: "83dfad66-35c4-4b9e-895d-2bc9238ccccf"
type: "requirement"
label: "Studio waits for the agent"
action: "Studio shall hold its own saves, say once that it waits for the agent, merge its edits into each of the agent's changes it reloads, and save them once the agent pauses; and the MCP server shall mark the folder as written by an agent after each write."
ears_type: "state-driven"
precondition: "an agent has written the open folder model over MCP in the last 15 seconds (.radical/agent-activity.json)"
rationale: "While an agent works, every Studio save would meet a folder that changed since it was read; holding them leaves the agent's writes alone, and the reload merge keeps the user's edits. Evidence: apps/mcp/src/folderModel.ts (markAgentWriting), packages/common/src/formats/agentActivity.ts, apps/studio/src/renderer/src/persistence/autosave.ts (flushPersist, holdForAgent), apps/studio/src/renderer/src/store/documentStore.ts (agentWritingUntil), apps/studio/src/main/index.ts (folder:read-agent-activity)"
---
