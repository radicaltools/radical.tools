---
id: "0f4d37a6-4ca1-498a-833c-bdc82583375d"
type: "requirement"
label: "Questions never block Forge"
action: "Radical Forge shall continue to the stage without questions."
ears_type: "unwanted-behaviour"
rationale: "A malformed or failed side call must not stall the wizard. Evidence: packages/common/src/ai/forge/clarify.ts:42-56; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:314-319"
unwanted_condition: "the clarifying-question call fails or returns no valid question list"
---
