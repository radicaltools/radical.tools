---
id: "7d3b91fe-3717-465a-89e3-46a0e1f88681"
type: "requirement"
label: "Forge builds the domain model"
action: "Radical Forge shall add the domains and entities the requirements talk about in their words, group entities into aggregates with part-of, link aggregates with references, map how the domains relate, link each entity to its requirements, and file them into a Domain view and the Conceptual view."
ears_type: "event-driven"
rationale: "One language for the whole run: later stages reuse the entities instead of inventing names. Evidence: packages/common/src/ai/forge/prompts.ts ('domain'); packages/common/src/ai/forge/views.ts; packages/common/tests/forgePrompts.test.ts; packages/common/tests/forgeViews.test.ts; apps/mcp/src/forge.test.ts; apps/e2e/tests/studio/forge.spec.ts"
trigger: "the user generates the Domain model stage, right after the requirements"
---
