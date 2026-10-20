---
id: "45c95a3b-968d-4b77-8fc3-94af06de5087"
type: "component"
label: "Document store and persistence"
technology: "Zustand, localStorage, IndexedDB, File System Access API"
---

store/documentStore.ts, persistence/autosave.ts, persist/webFolder.ts, DocumentManager.tsx and ModelSteps.tsx (the Models dialog and the New model and Open steps it shares with the Welcome screen), persistence/changeFlash.ts (the highlight of outside changes), persistence/branchChanges.ts (polls the folder's .radical/base.json, compares the model with it as it is edited and puts the changes on the canvas while Changes on branch is on), persistence/selection.ts (the canvas selection written to .radical/selection.json for the MCP server) and persistence/agentVersion.ts (after each outside change it reads the agent's .radical/agent-activity.json and, when its MCP server is of another product version than Studio, says once per model and version which is older). The model list and its three sources: localStorage (browser default), a JSON file (.radical/.c4.json) and a Markdown folder. Autosaves 400 ms after the last change, flushes on pagehide, polls folders for outside edits, reads a folder model whole (its element descriptions included) and the files beside it (readModelBase, readForgeRun, readAgentActivity, readCheckFiles), refuses to save over an unreadable file, imports Structurizr DSL.
