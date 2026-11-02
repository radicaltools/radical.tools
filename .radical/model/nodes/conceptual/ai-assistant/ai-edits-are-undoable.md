---
id: "b648d253-5b56-4e46-8f44-1a720925fefb"
type: "requirement"
label: "AI edits are undoable"
action: "Studio shall record each model change made through the AI assistant or Radical Forge as an ordinary undo step."
ears_type: "ubiquitous"
rationale: "Users must be able to back out an unwanted AI change with Cmd/Ctrl+Z. Evidence: apps/studio/src/renderer/src/ai/useDiagramFacade.ts:20-43; packages/ui/src/store/diagramStore.ts:1464-1471,1566-1574,1825-1835; manual#ai"
---
