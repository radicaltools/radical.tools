---
id: "5c2f7df2-9042-4d25-ae20-0bee0371ef0c"
type: "requirement"
label: "Step bar shows refinements"
action: "Studio shall mark that stage on the step bar with how many refinements the user accepted (amber while a proposal waits for the answer, its tooltip naming the types refined), and the agent's run shall say that the agent waits for the user's answer to a proposed refinement"
ears_type: "event-driven"
rationale: "The step bar is where the run's state is read at a glance; a stage that changed earlier stages, or waits to, must show it there, not only in the card under the stage. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (forge-step-refined); apps/studio/src/renderer/src/components/AgentForgeModal.tsx; packages/common/src/formats/forgeRunStatus.ts (refined, asking)"
trigger: "a Forge stage proposes or has refined earlier stages, in Studio's wizard or in an agent's run over MCP"
---
