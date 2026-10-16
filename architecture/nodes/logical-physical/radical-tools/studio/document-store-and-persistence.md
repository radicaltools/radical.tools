---
id: "45c95a3b-968d-4b77-8fc3-94af06de5087"
type: "component"
label: "Document store and persistence"
technology: "Zustand, localStorage, IndexedDB, File System Access API"
---

store/documentStore.ts, persistence/autosave.ts, persist/webFolder.ts, DocumentManager.tsx and ModelSteps.tsx (the Models dialog and the New model and Open steps it shares with the Welcome screen), persistence/changeFlash.ts (the highlight of outside changes), persistence/descriptions.ts (the descriptions an md folder has not loaded yet, from its files, for comparing two copies of the model), persistence/branchChanges.ts (polls the folder's .radical/base.json, compares the model with it as it is edited and puts the changes on the canvas while Changes on branch is on) and persistence/selection.ts (the canvas selection written to .radical/selection.json for the MCP server). The model list and its three sources: localStorage (browser default), a JSON file (.radical/.c4.json) and a Markdown folder. Autosaves 400 ms after the last change, flushes on pagehide, polls folders for outside edits, reads a folder's element descriptions on demand and the files beside it (readModelBase, readForgeRun, readCheckFiles), refuses to save over an unreadable file, imports Structurizr DSL.
