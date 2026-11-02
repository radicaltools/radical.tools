---
id: "80fb7d0f-9084-4b24-8ad1-dd48e23af036"
type: "requirement"
label: "Live Forge progress"
action: "Radical Forge shall show the current round, each action with resolved element names, failed actions, and the tokens used, plus a running token total for the whole session."
ears_type: "state-driven"
precondition: "a Forge stage is generating"
rationale: "Users see what is happening and what it costs instead of a static spinner. Evidence: apps/studio/src/renderer/src/ai/runner.ts:28-37,72-111,170,217-221,246; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:356-370,622-630,794-850"
---
