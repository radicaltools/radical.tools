---
id: "83cc122a-c0cf-4e92-ba26-7efea2fde95f"
type: "requirement"
label: "Layout progress for agents"
action: "send a progress notification after each step of Smart Layout, naming the phase and how far it is"
ears_type: "optional"
feature: "the MCP client asked for progress on a call"
rationale: "Long smart_layout and forge_arrange runs report where they are instead of going silent. Only a client that passed a progress token gets them. Evidence: apps/mcp/src/index.ts (progressToken, notifications/progress), apps/mcp/src/folderModel.ts (smartLayout onProgress), apps/mcp/src/folderModel.test.ts › reports each step to a client that asked for progress"
---
