---
id: "1a18617c-855c-44a9-96b9-ad5dd4bfcc16"
type: "requirement"
label: "Autosave after edits"
action: "Studio shall save the active model to the storage it lives in (local storage, file or folder) about 400 ms after the last change."
ears_type: "event-driven"
rationale: "Nobody has to remember to save, and the files on disk stay current for git and agents. Evidence: apps/studio/src/renderer/src/persistence/autosave.ts:55-112; apps/studio/src/renderer/src/store/documentStore.ts:655-664; manual#documents"
trigger: "the model changes in Designer or the Metamodel editor"
---
