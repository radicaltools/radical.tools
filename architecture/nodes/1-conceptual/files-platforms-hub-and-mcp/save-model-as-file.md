---
id: "c3352f3e-6e07-4404-a4dd-2977eb2924f3"
type: "requirement"
label: "Save model as file"
action: "Studio shall write the model as one JSON file, through a native Save dialog that turns the entry into a file-backed model in the desktop app, or as a .c4.json download that keeps the model in local storage in the browser."
ears_type: "event-driven"
rationale: "Gives a single portable file to commit or share. Evidence: apps/studio/src/renderer/src/store/documentStore.ts:746-787; apps/studio/src/main/index.ts:102-116; apps/studio/src/renderer/src/components/DocumentManager.tsx:196-201,400-402; apps/studio/tests/saveAsFile.test.ts; manual#documents"
trigger: "the user chooses Save as file… on a local model"
---
