---
id: "dce41433-b08d-4718-ad42-4a875140d626"
type: "requirement"
label: "Moves keep descriptions"
action: "write each element's description into the file the element moves to, so a rename or move never loses it."
ears_type: "event-driven"
rationale: "A rename or a new parent moves an element's file and the save removes the old one; the description must go along. Evidence: apps/studio/src/renderer/src/store/documentStore.ts (saveDocument), apps/studio/tests/mdFolderSafety.test.ts, apps/studio/tests/mdFolderDocument.test.ts"
trigger: "Studio saves a folder model in which elements were renamed or moved"
---
