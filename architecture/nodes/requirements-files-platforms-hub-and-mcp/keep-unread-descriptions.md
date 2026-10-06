---
id: "dce41433-b08d-4718-ad42-4a875140d626"
type: "requirement"
label: "Keep unread descriptions"
action: "Studio shall re-read the descriptions it has not loaded yet from their files and write them along, so a rename or move never loses them."
ears_type: "event-driven"
rationale: "Folder models load descriptions lazily; a save must not clobber a body nobody opened. Evidence: apps/studio/src/renderer/src/store/documentStore.ts:205-240,277-284; apps/studio/tests/mdFolderSafety.test.ts; apps/studio/tests/mdFolderDocument.test.ts"
trigger: "Studio saves a folder model with element descriptions not yet read from disk"
---
