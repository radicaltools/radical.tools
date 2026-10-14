---
id: "2e07b9dd-3529-40ef-bf21-b948ab0fbb02"
type: "requirement"
label: "Empty file starts a model"
action: "Studio shall start an empty model with the Radical metamodel, bound to that file."
ears_type: "event-driven"
rationale: "A new, empty .radical file in VS Code or an empty --file launch file opens as a blank Radical model instead of an error. Evidence: apps/studio/src/renderer/src/persistence/autosave.ts (loadActive, getWatchedPath), apps/studio/src/renderer/src/store/documentStore.ts (loadDocument), apps/vscode/README.md"
trigger: "Studio is opened by its host (the VS Code editor or the desktop app's --file) on a file that is empty"
---
