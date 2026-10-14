---
id: "d7403bea-6d05-4284-b64f-8c2716d74963"
type: "requirement"
label: "No write-back of reloads"
action: "Studio shall treat the reloaded content as already saved and not queue an autosave of it."
ears_type: "event-driven"
rationale: "Writing a reload straight back would churn files and race the other editor. Evidence: apps/studio/src/renderer/src/persistence/autosave.ts:76-79,114-156; apps/e2e/tests/studio/folders.spec.ts:111-125"
trigger: "Studio reloads a model because its storage changed outside the app"
---
