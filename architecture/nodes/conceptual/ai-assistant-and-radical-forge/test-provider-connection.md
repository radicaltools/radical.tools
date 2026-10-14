---
id: "bbc52157-67fa-4ff8-a262-bc2e7744da23"
type: "requirement"
label: "Test provider connection"
action: "Studio shall send a minimal ping to the provider being edited and show either OK with the provider's reply or the error message."
ears_type: "event-driven"
rationale: "Users verify a key, model and URL before relying on them. Evidence: apps/studio/src/renderer/src/components/AISettingsModal.tsx:79-99,260-273; manual#ai"
trigger: "the user presses Test connection in the AI providers dialog"
---
