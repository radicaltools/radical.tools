---
id: "d3f5a3c4-2f9b-41fd-8e38-b16c76f5863e"
type: "component"
label: "Forge over MCP"
technology: "TypeScript, @radical/common/ai/forge, @radical/hub-catalogue"
---

apps/mcp/src/forge.ts. The forge_* tools (forge_start, forge_clarify, forge_generate, forge_complete_stage, forge_reject_refinements, forge_arrange, forge_wireframe, forge_import_hub_concept, forge_finish) and FORGE_PROCEDURE, the text of the forge prompt. Keeps one run in memory (need, answers, stage summaries, the model before each stage, what each stage added and refined), refuses steps out of order, hands the agent the shared clarify and stage prompts with the Hub candidates ranked from the catalogue the build bundles and the open gaps, lists a completed stage's refinements of earlier stages for the user to keep or reject, files each stage's elements into the Forge views with a place beside what they already show, and after every step writes .radical/forge-run.json for Studio.
