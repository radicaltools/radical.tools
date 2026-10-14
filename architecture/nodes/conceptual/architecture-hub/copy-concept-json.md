---
id: "7e1f8c36-8e27-4614-8cab-01e03221eeca"
type: "requirement"
label: "Copy concept JSON"
action: "The Hub shall copy the concept's .radical document to the clipboard and confirm it, or tell the user to use Download instead when the clipboard is not available."
ears_type: "event-driven"
rationale: "The copied text is the same document Download saves. Evidence: apps/hub/src/HubApp.tsx (copyJson, conceptJson)"
trigger: "the user clicks Copy JSON on an open concept"
---
