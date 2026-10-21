---
id: "958e368d-4eaa-4cba-ae55-cd467c3fad98"
type: "requirement"
label: "Move to browser"
action: "Studio shall keep the model, as it is shown, in this browser's storage, leave the file or folder on disk as it is and no longer watch it, and do nothing for a model already kept in this browser"
ears_type: "event-driven"
rationale: "The Models dialog offered Move to a file and Move to a folder but no way back to the browser; the maintainer decided on 2026-10-21 (D19, exploratory runs 45 to 64) to add Move to browser. Evidence: apps/studio/src/renderer/src/components/DocumentManager.tsx, apps/studio/src/renderer/src/store/documentStore.ts (moveToBrowser), apps/studio/tests/moveToBrowser.test.ts"
trigger: "the user chooses Move to browser in the ⋯ menu of a model kept in a file or a folder in the Models dialog, and confirms"
---
