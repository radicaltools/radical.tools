---
id: "8c9ea1da-6a49-4b9f-8424-f94a36252078"
type: "requirement"
label: "Eight ordered Forge stages"
action: "Radical Forge shall generate the model in eight stages in this order: Requirements (EARS), Domain model, Fitness functions, Gherkin scenarios, State machines, Processes, Mockups, C4 model."
ears_type: "ubiquitous"
rationale: "The behaviour and quality spec is settled first so the architecture follows from it; the domain model follows the requirements it is read from so later stages share its language (added 2026-10-09), state machines follow the scenarios they are derived from, and processes follow both (added 2026-10-18): the scenarios are examples of their paths. Evidence: packages/common/src/ai/forge/prompts.ts (FORGE_STAGES); apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (STEP_LABELS); packages/common/tests/forgePrompts.test.ts; manual#forge"
---
