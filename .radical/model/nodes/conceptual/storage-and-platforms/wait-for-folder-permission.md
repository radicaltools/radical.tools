---
id: "6f99e8b7-da50-4762-8319-94ee49a997e1"
type: "requirement"
label: "Wait for folder permission"
action: "Studio shall not write to that file or folder until the user grants access again, by opening the model from the Welcome screen or the Models dialog or with Reconnect… on its row, after which it reloads the model."
ears_type: "state-driven"
precondition: "a browser file or folder model's permission has not been granted again in this session"
rationale: "A permission-pending handle after a reload must never overwrite the user's files with an empty or stale model. Evidence: apps/studio/src/renderer/src/store/documentStore.ts:39-44,300-306,906-915; apps/studio/src/renderer/src/components/DocumentManager.tsx:126-138,406-408; manual#documents"
---
