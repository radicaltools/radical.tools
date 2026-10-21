---
id: "24affbea-0b06-414d-8869-238fc59627ad"
type: "requirement"
label: "Undo keeps outside changes"
action: "Studio shall keep Designer's undo history and make each step's undo and redo on the model with the outside change in it, never taking that change back; keep an element the outside change built on (a child added into it, a relation drawn to it) when the step that added it is undone, with what was built on it; keep what is typed into a field while the model reloads as one step; and name any value where the outside change was kept, and any element kept for what was built on it"
ears_type: "event-driven"
rationale: "Since Studio and an agent edit one folder at once (#222), every agent write reloads the model; forgetting the history then left Undo grey for an agent's whole run (exploratory run 29, 2026-10-20). An outside change is never undone by the user's Undo (item 36). Exploratory runs 45 to 64 (2026-10-21) found Undo of an add removing the agent's child or relation with it (item 163), typing split into steps by an agent's write (item 164), Undo of Keep in a row leaving the row nudged (item 165), and the history cleared by an agent's write while the Inspector, the metamodel editor, Viewer or Presenter was open. In a milestone the history is still cleared. Evidence: packages/ui/src/store/diagramStore.ts (loadDiagram outsideChange, _historyRebased, _rebasedEntry, _keptBuiltOn), apps/studio/src/renderer/src/persistence/autosave.ts, packages/common/src/modelMerge.ts (mergeModels)"
trigger: "Studio reloads an open folder model that changed outside it (an agent's write, an editor) while Designer shows the live model, or while the Inspector, the metamodel editor, Viewer or Presenter is open over it"
---
