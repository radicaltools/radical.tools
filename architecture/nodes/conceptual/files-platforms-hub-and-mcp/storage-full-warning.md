---
id: "4c737e21-2450-4e40-989e-f0fa98925b2d"
type: "requirement"
label: "Storage full warning"
action: "Studio shall tell the user that browser storage is full and suggest deleting models or saving this one as a file or folder, say so once per session for autosaves, and add no new model it could not store."
ears_type: "unwanted-behaviour"
rationale: "localStorage quota errors were swallowed, and a new model then showed the old one. Evidence: apps/studio/src/renderer/src/store/documentStore.ts (StorageFullError, createLSDocument, renameDocument, saveDocument), apps/studio/src/renderer/src/persistence/autosave.ts (reportSaveError), apps/studio/src/renderer/src/components/ModelSteps.tsx (createInBrowser), apps/studio/src/renderer/src/components/DocumentManager.tsx."
unwanted_condition: "browser storage refuses to store a model, its new name or a new model"
---
