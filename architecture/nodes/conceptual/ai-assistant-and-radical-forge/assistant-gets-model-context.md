---
id: "6978d003-7ad0-4676-b2ec-98bcdb8a3bb5"
type: "scenario"
label: "Assistant gets model context"
given: "a model with nodes, relations, views and an active metamodel"
tests: |
  apps/studio/tests/aiSystemPrompt.test.ts › AI_SYSTEM_PROMPT contract › instructs the model to follow metamodel rules
  apps/studio/tests/aiSystemPrompt.test.ts › buildContextMessage › serialises base fields and spreads governance properties, but not layout
  apps/studio/tests/aiSystemPrompt.test.ts › buildContextMessage › serialises view kind
  apps/studio/tests/aiSystemPrompt.test.ts › buildSystemMessages › returns exactly the prompt and (cacheable) metamodel messages, in order — the diagram-state message now lives in the conversation turns instead (see ai/runner.ts)
  packages/common/tests/aiMetamodelContext.test.ts › buildMetamodelMessage › includes each type's properties, so the model knows valid property-bag keys
  apps/studio/tests/aiRunner.test.ts › runAIPrompt — end-to-end with mocked Anthropic tool-calling › caches the growing within-stage prefix: a rolling second cache_control breakpoint moves forward each round instead of accumulating
then: "the system messages are the rules prompt, which names the metamodel and allowedParents, and a metamodel message listing each type's properties; every round's last message carries a fresh \"Current diagram state\" snapshot with labels, governance properties, relation types and view kinds but no x, y, width or height"
when: "the AI assistant sends a request round to the provider"
---
