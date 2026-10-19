---
id: "0eed4dcc-7547-430d-abb5-3ddf2e18c5ab"
type: "requirement"
label: "Reload keeps unsaved edits"
action: "Studio shall show the outside change merged with its own edits, keep its edits to be saved, and say which fields kept the outside value."
ears_type: "event-driven"
rationale: "Reloading from disk used to replace the model in memory, so edits made in the last moments, or while an agent worked, were lost. Evidence: apps/studio/src/renderer/src/persistence/autosave.ts (loadActive merges unsaved edits from the model they were made on, _baseModel; reportMergeConflicts), apps/studio/src/renderer/src/store/documentStore.ts (onSaveMerged), packages/common/src/modelMerge.ts"
trigger: "the open folder model changed outside Studio while Studio has edits not saved yet, or a save of Studio's merged with such a change"
---
