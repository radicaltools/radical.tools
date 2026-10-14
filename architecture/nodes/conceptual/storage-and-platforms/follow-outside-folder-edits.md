---
id: "21c84dc3-e1c2-4c3f-a624-05ea462175ac"
type: "requirement"
label: "Follow outside folder edits"
action: "Studio shall check the folder for model-file edits made outside the app (every second in the desktop app, every two seconds in the browser) and reload the model when one is found, keeping the active view and selection."
ears_type: "state-driven"
precondition: "a folder-backed model is the active model"
rationale: "Hand edits, git checkouts and agent edits appear without a manual reload. Evidence: apps/studio/src/main/index.ts:13-31,211-223; apps/studio/src/renderer/src/store/documentStore.ts:72,920-975; apps/studio/src/renderer/src/persistence/autosave.ts:158-178; packages/common/src/formats/mdFolderSync.ts:97-110; apps/studio/tests/mdFolderWatch.test.ts; manual#documents, manual#mcp"
---
