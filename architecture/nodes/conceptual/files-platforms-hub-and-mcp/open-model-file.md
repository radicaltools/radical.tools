---
id: "01140a26-a20b-4a3b-901a-be71a0d27c28"
type: "requirement"
label: "Open model file"
action: "Studio shall add the chosen JSON model to the model list bound to that file, save later changes back into it and reopen it from the file (the desktop app through its file dialogs, Chromium browsers through the File System Access API), copy it into a new model kept in this browser where the browser has no such API, and ignore a file without nodes and relations arrays."
ears_type: "event-driven"
rationale: "Brings existing .radical (as downloaded from the Hub), .c4.json and JSON models in without conversion, and keeps them where they are. The browser used to copy the file into a new local-storage model. Evidence: apps/studio/src/renderer/src/store/documentStore.ts; apps/studio/src/main/index.ts; apps/studio/tests/openFile.test.ts; apps/e2e/tests/studio/files.spec.ts; manual#formats"
trigger: "the user picks a model file with Open file…"
---
