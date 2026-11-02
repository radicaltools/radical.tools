---
id: "05681879-ee73-4bbb-bcd4-11c937d0f3a4"
type: "need"
label: "Know when saving fails"
kind: "other"
source: "Reconstructed from the code, 2026-10-14"
---

When Studio cannot keep my model where I asked it to, because the browser's storage is full, I want to be told at once what happened and what I can do (delete models, or keep this one in a file or a folder), not find out later that my work is gone. Reconstructed from: apps/studio/src/renderer/src/store/documentStore.ts (StorageFullError), apps/studio/src/renderer/src/persistence/autosave.ts (reportSaveError), apps/studio/src/renderer/src/components/ModelSteps.tsx, apps/studio/src/renderer/src/components/DocumentManager.tsx.
