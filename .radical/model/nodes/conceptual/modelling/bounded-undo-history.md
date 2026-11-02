---
id: "02e5d47c-2558-44bc-b73c-ba15b62a853e"
type: "requirement"
label: "Bounded undo history"
action: "Studio shall keep up to 100 undo steps of the elements, relations and views, each change of a view's settings (its type, Auto-layout, Multi page, Depth, Size and Levels) a step of its own that Undo of an earlier step leaves as set, and clear the redo steps whenever a new change is recorded."
ears_type: "ubiquitous"
rationale: "Undo is the safety net that lets people experiment with the model. The maintainer decided on 2026-10-21 (exploratory runs 65 to 69) that the Auto-layout select is an undo step of its own: it had been taken back by the Undo of an earlier step. Evidence: packages/ui/src/store/diagramStore.ts:107-135, packages/ui/src/store/diagramStore.ts:3106-3136 (setViewLayoutMode); apps/studio/src/renderer/src/components/Toolbar.tsx:564-586, apps/studio/src/renderer/src/components/Toolbar.tsx:700-715; packages/ui/tests/undo.test.ts:47-95; README (named undo/redo)"
---
