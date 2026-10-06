---
id: "33298550-a87e-43b0-8116-33a625cac6cd"
type: "requirement"
label: "Undo and redo edits"
action: "Studio shall undo, or redo, the last model change, keeping up to 100 steps of history."
ears_type: "event-driven"
rationale: "Undo makes bold restructuring safe. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx:564-586,700-716; packages/ui/src/store/diagramStore.ts:115,131-135,3106-3137; packages/ui/tests/undo.test.ts:47-95; manual#shortcuts; manual#selection"
trigger: "the user presses ⌘/Ctrl+Z, or ⌘/Ctrl+Shift+Z or ⌘/Ctrl+Y"
---
