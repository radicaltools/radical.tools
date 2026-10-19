---
id: "5c2f7df2-9042-4d25-ae20-0bee0371ef0c"
type: "requirement"
label: "Step bar shows refinements"
action: "Studio shall mark that stage on the step bar with how many refinements it has (amber in the wizard until the user keeps or rejects them, its tooltip naming the types refined), and the agent's run shall say that the agent waits for the user to choose which refinements to keep"
ears_type: "event-driven"
rationale: "The step bar is where the run's state is read at a glance; a stage that changed earlier stages must show it there, not only in the panel under the stage. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (forge-step-refined); apps/studio/src/renderer/src/components/AgentForgeModal.tsx; packages/common/src/formats/forgeRunStatus.ts (refined)"
trigger: "a Forge stage has refined earlier stages, in Studio's wizard or in an agent's run over MCP"
---
