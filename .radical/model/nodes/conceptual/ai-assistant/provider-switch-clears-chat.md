---
id: "6dc8ed65-88f5-4910-91db-f0b218584efc"
type: "scenario"
label: "Provider switch clears chat"
gherkin: "# Not covered by an automated test"
given: "an AI conversation of several turns with OpenAI in Quick Search"
then: "the conversation and last answer are cleared and the next prompt starts a new conversation"
when: "the user makes Gemini the active provider"
---
