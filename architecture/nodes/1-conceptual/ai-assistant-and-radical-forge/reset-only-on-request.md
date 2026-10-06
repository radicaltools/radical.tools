---
id: "8d4fc219-9b40-49a5-b645-55c706129ea0"
type: "requirement"
label: "Reset only on request"
action: "The AI assistant shall erase the whole model only when the user explicitly asks to start from scratch or replace the model."
ears_type: "ubiquitous"
rationale: "reset_diagram removes every node, relation and view, so it must never be a side effect. Evidence: apps/studio/src/renderer/src/ai/systemPrompt.ts:23; packages/common/src/ai/tools/modelTools.ts:28-31,62-67; apps/studio/src/renderer/src/ai/useDiagramFacade.ts:91-102"
---
