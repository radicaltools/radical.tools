---
id: "0eed4dcc-7547-430d-abb5-3ddf2e18c5ab"
type: "requirement"
label: "Reload after refused save"
action: "Studio shall reload the model from the folder and not mark the save as done, so the outside edit wins."
ears_type: "event-driven"
rationale: "Complements the refusal: the user sees the outside edit instead of a silently stale canvas. Evidence: packages/common/src/formats/mdFolderSync.ts:73-79; apps/studio/src/renderer/src/store/documentStore.ts:286-296,310-317; apps/studio/src/renderer/src/persistence/autosave.ts:158-161; apps/studio/tests/mdFolderWatch.test.ts ('keeps the document unchanged on disk when a save is refused as a conflict')"
trigger: "a folder save is refused because model files changed on disk since they were read"
---
