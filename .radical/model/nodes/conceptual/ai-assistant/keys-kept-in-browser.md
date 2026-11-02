---
id: "9d1ad440-dbc8-482f-8e5d-bbf548cb4c3d"
type: "requirement"
label: "Keys kept in browser"
action: "Studio shall store the AI settings, including API keys, only in this browser's local storage and shall warn in the AI providers dialog against using shared machines for sensitive keys."
ears_type: "ubiquitous"
rationale: "No server holds the user's keys, so the trade-off of plain-text local storage must be stated. Evidence: apps/studio/src/renderer/src/ai/settings.ts:1-8,71-91; apps/studio/src/renderer/src/components/AISettingsModal.tsx:143-146; manual#ai"
---
