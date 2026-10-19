---
id: "8976767a-65f3-4b1e-b5c3-db5d61409d0f"
type: "component"
label: "Radical Forge"
technology: "React"
---

RadicalForgeModal.tsx, plus ai/forgeClarify.ts and ai/mockupWireframe.ts (the provider calls), ai/forgeStageOutput.ts and export/downloadGherkinFiles.ts; AgentForgeModal.tsx and persistence/agentForge.ts show an agent's run over MCP read-only and pulse the Forge button. Turns a brief (stored as a need) into requirements, a domain model, fitness functions, Gherkin scenarios, state machines, processes, mockups and C4 in reviewed stages, and ends with a Review stage over the whole model. When a stage finds what an earlier stage lacks, it pauses on a proposal card showing exactly what it would add or change, and applies it only if the user adds it (the runner's propose_refinement tool and guard); the open gaps follow the stage. The stages, prompts, clarifying-question prompt, Hub matches, proposals, refinements, gaps and wireframe prompt come from @radical/common/ai/forge, which the MCP server's forge_* tools use too.
