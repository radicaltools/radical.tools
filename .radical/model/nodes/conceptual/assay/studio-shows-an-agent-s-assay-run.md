---
id: "5417eacf-7bca-415f-aeaf-02fd4cddf50e"
type: "requirement"
label: "Studio shows an agent's Assay run"
action: "Studio shall show an Assay button beside the Forge button that pulses (blue while the agent works, amber while proposals wait for the user's answer) with the stage the run is at, open a read-only view of the run's stages, repositories, refused plans and waiting proposals when clicked, with Follow on the canvas, and go away 30 minutes after the run finished, its client closed or it went quiet"
ears_type: "state-driven"
precondition: "an agent runs Radical Assay over the MCP server on the model folder Studio has open"
rationale: "The user follows the run where they look at the model and knows when the agent waits for their answer; Studio cannot run Assay itself (only the agent reads the code's directories), so the button shows only an agent's run. Evidence: apps/studio/src/renderer/src/persistence/agentAssay.ts; apps/studio/src/renderer/src/components/AgentAssayModal.tsx; apps/studio/src/renderer/src/components/QuickSearch.tsx (qs-assay-toggle); apps/studio/src/main/index.ts (folder:read-assay-run)."
---
