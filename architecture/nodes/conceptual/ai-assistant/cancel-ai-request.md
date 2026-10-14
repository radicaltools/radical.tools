---
id: "56adf307-83f8-425b-b5dd-ce5ac7b9d5a0"
type: "requirement"
label: "Cancel AI request"
action: "Studio shall abort the request and keep the changes already applied."
ears_type: "event-driven"
rationale: "Users must be able to stop a slow or wrong run. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx:150-152,548-560; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:409,421-449,571-573; apps/studio/src/renderer/src/ai/runner.ts:163,228"
trigger: "the user presses Cancel while an AI chat request or Forge step is running"
---
