---
id: "adcba35a-60a8-4239-91bb-b1d5afd321e7"
type: "requirement"
label: "Remove keeps disk files"
action: "Studio shall remove the model from the model list after the user confirms and leave the file or folder on disk untouched."
ears_type: "event-driven"
rationale: "The list is a library of pointers; deleting an entry must not destroy files the user owns. Evidence: apps/studio/src/renderer/src/components/DocumentManager.tsx:186-194,409; apps/studio/src/renderer/src/store/documentStore.ts:675-691"
trigger: "the user deletes a file-backed or folder-backed model in Manage models"
---
