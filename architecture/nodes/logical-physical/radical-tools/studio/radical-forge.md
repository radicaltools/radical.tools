---
id: "8976767a-65f3-4b1e-b5c3-db5d61409d0f"
type: "component"
label: "Radical Forge"
technology: "React"
---

RadicalForgeModal.tsx, plus ai/forgeClarify.ts and ai/mockupWireframe.ts (the provider calls), ai/forgeStageOutput.ts and export/downloadGherkinFiles.ts; AgentForgeModal.tsx and persistence/agentForge.ts show an agent's run over MCP read-only and pulse the Forge button. Turns a brief (stored as a need) into requirements, a domain model, fitness functions, Gherkin scenarios, state machines, processes, mockups and C4 in reviewed stages, and ends with a Review stage over the whole model. After each stage a Refinements panel lists what it added to or changed in earlier stages for the user to keep or reject, beside the open gaps. The stages, prompts, clarifying-question prompt, Hub matches, refinements, gaps and wireframe prompt come from @radical/common/ai/forge, which the MCP server's forge_* tools use too.
