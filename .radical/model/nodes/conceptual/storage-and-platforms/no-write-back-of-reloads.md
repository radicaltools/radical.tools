---
id: "d7403bea-6d05-4284-b64f-8c2716d74963"
type: "requirement"
label: "No write-back of reloads"
action: "Studio shall treat the content read as already saved and save nothing by itself: never in Viewer or Presenter, and in Designer only after a user edit (a step made, undone or redone, or a change other than of places), saving then what the layout settled since; and shall not write the camera of the view shown as All elements' camera on a reload; a camera moved on its own shall write nothing to the model, and a load shall open each view at the camera kept for it in this browser."
ears_type: "event-driven"
rationale: "Opening a model and letting its layout settle wrote the folder, so a model only looked at showed changes in git, and a merged reload wrote a view's camera as All elements'. The maintainer decided on 2026-10-21 (D15, exploratory runs 45 to 64) that a reload by itself saves nothing. With Smart fit off, a camera moved on its own was then lost on reload; each view's camera is now kept in the browser, outside the model (round 185–192, 2026-10-26, F-0084). Evidence: packages/ui/src/store/viewCameras.ts, apps/studio/src/renderer/src/persistence/autosave.ts (historyMark), packages/ui/src/store/diagramStore.ts (loadDiagram), apps/studio/tests/loadSavesNothing.test.ts"
trigger: "Studio opens a model, or reloads it because its storage changed outside the app"
---
