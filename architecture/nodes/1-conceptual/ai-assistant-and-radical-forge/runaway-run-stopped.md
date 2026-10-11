---
id: "2129a7c6-796b-45a5-9371-69589eb0cb0b"
type: "scenario"
label: "Runaway run stopped"
gherkin: "# Covered by: apps/studio/tests/aiRunner.test.ts › runAIPrompt — end-to-end with mocked Anthropic tool-calling › stops after maxIterations if the model never returns a final answer"
given: "a model that keeps returning tool calls"
then: "the run stops and reports \"Stopped after 12 tool-calling rounds without a final answer.\""
when: "the assistant has run 12 tool-calling rounds"
---
