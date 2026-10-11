---
id: "a9838f5e-703f-4539-85a2-a68cca679a51"
type: "scenario"
label: "Ask what depends on"
gherkin: |
  And the model is not changed
  # Covered by: apps/studio/tests/aiRunner.test.ts › runAIPrompt — end-to-end with mocked Anthropic tool-calling › runs search_model and continues with the next round
given: "a model with an Event Bus that three services publish to, and AI configured"
then: "the assistant runs a search_model query, gets the exact dependents, and answers with those three services"
when: "the user asks in AI mode \"what depends on the Event Bus?\""
---
