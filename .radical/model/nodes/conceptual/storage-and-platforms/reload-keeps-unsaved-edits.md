---
id: "0eed4dcc-7547-430d-abb5-3ddf2e18c5ab"
type: "requirement"
label: "Reload keeps unsaved edits"
action: "Studio shall show the outside change merged with the edits its store holds when the read of the folder is back (what was typed while it was read too, also when a folder opened from an old cache is read again), keep its edits to be saved, and say which fields kept the outside value; edits kept in the browser for the next visit are dropped once nothing differs from what was saved, so an edit undone stays undone."
ears_type: "event-driven"
rationale: "Reloading from disk used to replace the model in memory, so edits made in the last moments, or while an agent worked, were lost. The edits were taken when the read started, so what was typed while it ran was replaced (F-0142, round 201–210). Evidence: apps/studio/src/renderer/src/persistence/autosave.ts (loadActive merges the unsaved edits the store holds when the read is back, from the model they were made on, _baseModel; reportMergeConflicts), apps/studio/src/renderer/src/store/documentStore.ts (onSaveMerged), packages/common/src/modelMerge.ts"
trigger: "the open folder model changed outside Studio while Studio has edits not saved yet, or a save of Studio's merged with such a change"
---
