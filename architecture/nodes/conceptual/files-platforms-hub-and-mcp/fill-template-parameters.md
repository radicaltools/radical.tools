---
id: "38cea0ff-61a0-42fc-8bef-861d5c3197b6"
type: "requirement"
label: "Fill template parameters"
action: "Studio shall ask for the parameter values, substitute them into the imported elements and keep them as a Hub template record that the element's Hub template section can change later."
ears_type: "event-driven"
rationale: "Generic concepts (a latency budget, an endpoint) become specific to the user's system. Evidence: apps/studio/src/renderer/src/components/HubImportModal.tsx:268-296,421-430,622-645,740-743; packages/ui/src/components/RightPanel.tsx:1528-1615; manual#hub"
trigger: "the user adds a Hub concept that has template parameters"
---
