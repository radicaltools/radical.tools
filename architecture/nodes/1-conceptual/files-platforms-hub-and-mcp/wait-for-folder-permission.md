---
id: "6f99e8b7-da50-4762-8319-94ee49a997e1"
type: "requirement"
label: "Wait for folder permission"
action: "Studio shall not write to that folder until the user grants access again with Reconnect…, after which it reloads the model from the folder."
ears_type: "state-driven"
precondition: "a browser folder model's directory permission has not been confirmed in this session"
rationale: "A permission-pending handle after a reload must never overwrite the user's files with an empty or stale model. Evidence: apps/studio/src/renderer/src/store/documentStore.ts:39-44,300-306,906-915; apps/studio/src/renderer/src/components/DocumentManager.tsx:126-138,406-408; manual#documents"
---
