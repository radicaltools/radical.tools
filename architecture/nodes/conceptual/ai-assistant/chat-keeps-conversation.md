---
id: "916ed981-772a-4f1b-8bbb-422d93d6b008"
type: "requirement"
label: "Chat keeps conversation"
action: "The AI assistant shall send the earlier turns of that conversation with each new prompt until the user clears the conversation or switches the active provider."
ears_type: "state-driven"
precondition: "an AI chat conversation is open in Quick Search"
rationale: "Follow-up requests ('now connect it to the API') need the previous turns, but a provider switch cannot replay another provider's tool-call format. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx:49,84-95,121-128,587-595,615-618"
---
