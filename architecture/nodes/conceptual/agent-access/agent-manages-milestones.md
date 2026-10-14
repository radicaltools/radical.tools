---
id: "9eb1254c-0c8f-4835-a384-61490b524da8"
type: "requirement"
label: "Agent manages milestones"
action: "The AI tool catalogue shall list, save, rename, delete and compare milestones and let a presentation slide show a milestone, without ever loading a milestone over the current model."
ears_type: "event-driven"
rationale: "An agent can record the as-is and target architecture as milestones and explain what changes between them, which the tools could not do before. Evidence: packages/common/src/ai/tools/milestoneTools.ts; packages/common/src/ai/tools/presentationTools.ts (slide milestone); apps/mcp/src/folderModel.ts (summary, read-only list/compare); packages/common/tests/aiDocumentTools.test.ts ('milestone tools'); apps/mcp/src/folderModel.test.ts ('milestones')"
trigger: "an agent (MCP client or Studio's AI chat) is asked to record, list, rename, delete or compare phases of the system"
---
