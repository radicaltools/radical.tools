---
id: "02e5d47c-2558-44bc-b73c-ba15b62a853e"
type: "requirement"
label: "Bounded undo history"
action: "Studio shall keep up to 100 undo steps of the elements, relations and views, and clear the redo steps whenever a new change is recorded."
ears_type: "ubiquitous"
rationale: "Undo is the safety net that lets people experiment with the model. Evidence: packages/ui/src/store/diagramStore.ts:107-135, packages/ui/src/store/diagramStore.ts:3106-3136; apps/studio/src/renderer/src/components/Toolbar.tsx:564-586, apps/studio/src/renderer/src/components/Toolbar.tsx:700-715; packages/ui/tests/undo.test.ts:47-95; README (named undo/redo)"
---
