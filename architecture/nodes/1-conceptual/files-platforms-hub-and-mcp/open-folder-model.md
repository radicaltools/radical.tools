---
id: "f9dfd49d-a81f-4c8b-b707-6e4639b0b69a"
type: "requirement"
label: "Open folder model"
action: "Studio shall add the folder to the model list as a folder-backed model and load it, without browser permission prompts in the desktop app and through the File System Access API in Chromium browsers."
ears_type: "event-driven"
rationale: "A model folder checked out from git must open directly. Evidence: apps/studio/src/renderer/src/store/documentStore.ts:789-839; apps/studio/src/main/index.ts:160-174; apps/studio/src/renderer/src/persist/webFolder.ts:36-52; manual#documents, manual#vscode"
trigger: "the user picks a model folder with Open folder…"
---
