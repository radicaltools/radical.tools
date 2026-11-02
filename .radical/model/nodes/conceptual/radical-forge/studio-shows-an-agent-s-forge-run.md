---
id: "ec90073b-5762-4fcf-9372-12fa99aa7fdb"
type: "requirement"
label: "Studio shows an agent's Forge run"
action: "Studio shall pulse its Forge button (blue while a stage is generated, amber while the agent waits for the user) with the stage the run is at, open a read-only view of the run's steps when clicked, and stop when the run finishes, the agent's client closes, or nothing changes for 30 minutes."
ears_type: "state-driven"
precondition: "an agent runs Radical Forge over the MCP server on the model folder Studio has open"
rationale: "The user follows the run where they look at the model and knows when the agent waits for them. Evidence: packages/common/src/formats/forgeRunStatus.ts; apps/mcp/src/folderModel.ts (writeForgeStatus, close); apps/studio/src/renderer/src/persistence/agentForge.ts; apps/studio/src/renderer/src/components/AgentForgeModal.tsx; packages/common/tests/forgeRunStatus.test.ts; apps/mcp/src/forge.test.ts ('tells Studio where the run stands', 'marks an unfinished run closed'); apps/e2e/tests/studio/folders.spec.ts"
---
