---
id: "39f7af68-309b-442e-a400-12a9bda47215"
type: "scenario"
label: "Add element by chat"
gherkin: ""
given: "a model with an API gateway and an accounts service, and AI configured"
tests: "apps/studio/tests/aiRunner.test.ts › runAIPrompt — end-to-end with mocked Anthropic tool-calling › executes tool calls from one round, then returns the final text answer"
then: "the assistant adds the cache and its two relations, and Quick Search shows the answer with \"+1 node · +2 relations\" and the tokens used"
when: "the user asks \"add a Redis cache between the API gateway and the accounts service\""
---
