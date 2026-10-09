---
id: "a07af769-bc42-4720-8c85-10eb172e348b"
type: "requirement"
label: "Forge models state machines"
action: "Radical Forge shall model each entity with a real lifecycle as a state machine (none when no entity has one), deriving its transitions from the scenarios (Given the source state, When the event, Then the target state), linking the scenarios to it with verifies and it to the requirements with satisfies, and file it into a States view; the C4 stage shall then link each machine to its owner with lifecycle-of."
ears_type: "event-driven"
rationale: "Scenarios already describe the state changes; a machine makes them checkable, and the screens and the C4 decomposition can follow the states. Evidence: packages/common/src/ai/forge/prompts.ts ('states'); packages/common/src/ai/forge/views.ts; packages/common/tests/forgePrompts.test.ts; apps/mcp/src/forge.test.ts ('runs the state machine stage after the scenarios'); apps/e2e/tests/studio/forge.spec.ts ('Forge builds the state machines')"
trigger: "the user generates the State machines stage, after the Gherkin scenarios and before the mockups"
---
