---
id: "21c84dc3-e1c2-4c3f-a624-05ea462175ac"
type: "requirement"
label: "Follow outside folder edits"
action: "Studio shall check the folder for model-file edits made outside the app (every second in the desktop app, every two seconds in the browser) and reload the model when one is found, keeping the active view, the selection, a milestone shown with its unsaved edits (the change going to the live model) and the presentation picked with its slide; while a presentation plays, the reload waits until it stops; while an element is held in a drag, until its drop has landed, the element staying under the pointer."
ears_type: "state-driven"
precondition: "a folder-backed model is the active model"
rationale: "Hand edits, git checkouts and agent edits appear without a manual reload. An agent's write during a drag threw the held element back to its start and the drop landed short (round 170–175, 2026-10-22, F-0026). Evidence: apps/studio/src/main/index.ts:13-31,211-223; apps/studio/src/renderer/src/store/documentStore.ts:72,920-975; apps/studio/src/renderer/src/persistence/autosave.ts (watchActive, reloadAtDrop); packages/ui/src/store/diagramStore.ts (dragHeld, afterDrag); packages/ui/src/layout/liveColaLayout.ts (release); packages/common/src/formats/mdFolderSync.ts:97-110; apps/studio/tests/mdFolderWatch.test.ts; manual#documents, manual#mcp"
---
