---
id: "e6abb346-57c0-48d2-a8a8-99a1c44c23e1"
type: "requirement"
label: "Clarifying questions first"
action: "Radical Forge shall ask the provider for up to four short clarifying questions and keep Generate disabled until the user confirms the answers or skips them."
ears_type: "event-driven"
rationale: "Answers to a few targeted questions change what gets generated more than guesses do. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:259-320,336-347,579-590; apps/studio/src/renderer/src/ai/forgeClarify.ts:61-114,149-172; manual#forge"
trigger: "a Forge stage is opened for the first time and AI is available"
---
