---
id: "45c95a3b-968d-4b77-8fc3-94af06de5087"
type: "component"
label: "Document store and persistence"
technology: "Zustand, localStorage, IndexedDB, File System Access API"
---

store/documentStore.ts, persistence/autosave.ts, persist/webFolder.ts, DocumentManager. The model list and its three sources: localStorage (browser default), a JSON file (.radical/.c4.json) and a Markdown folder. Autosaves 400 ms after the last change, flushes on pagehide, polls folders for outside edits, imports Structurizr DSL.
