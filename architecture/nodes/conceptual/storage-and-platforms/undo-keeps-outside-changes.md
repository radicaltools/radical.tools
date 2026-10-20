---
id: "24affbea-0b06-414d-8869-238fc59627ad"
type: "requirement"
label: "Undo keeps outside changes"
action: "Studio shall keep its undo history and make each step's undo and redo on the model with the outside change in it, never taking that change back, and name any value where the outside change was kept"
ears_type: "event-driven"
rationale: "Since Studio and an agent edit one folder at once (#222), every agent write reloads the model; forgetting the history then left Undo grey for an agent's whole run (exploratory run 29, 2026-10-20). An outside change is never undone by the user's Undo (item 36). In Viewer, Presenter or a milestone the history is still cleared. Evidence: packages/ui/src/store/diagramStore.ts (loadDiagram outsideChange, _historyRebased, _rebasedEntry), apps/studio/src/renderer/src/persistence/autosave.ts, packages/common/src/modelMerge.ts (mergeModels)"
trigger: "Studio reloads an open folder model that changed outside it (an agent's write, an editor) while the Designer perspective shows the live model"
---
