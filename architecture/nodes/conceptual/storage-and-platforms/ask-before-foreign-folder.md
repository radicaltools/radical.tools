---
id: "62993f8e-93a7-4b61-8a98-e7a661c8a07d"
type: "requirement"
label: "Ask before foreign folder"
action: "Studio shall write the model into that folder only after the user confirms, and leave the folder untouched when the user declines."
ears_type: "unwanted-behaviour"
rationale: "Saving into the wrong directory (a code repo root) must not silently scatter model files into it. Evidence: apps/studio/src/renderer/src/store/documentStore.ts:261-272,852-857,872; apps/studio/src/renderer/src/components/DocumentManager.tsx:117-124"
unwanted_condition: "the folder picked for Save as folder… already holds files but no radical.md manifest"
---
