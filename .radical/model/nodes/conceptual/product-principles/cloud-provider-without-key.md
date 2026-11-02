---
id: "42200464-c94e-44c0-a55a-0dcad938e8a7"
type: "scenario"
label: "Cloud provider without key"
gherkin: "And no request is sent to any provider"
given: "AI is enabled and Anthropic is the active provider with no API key"
then: "it shows \"Set an API key for Anthropic (Claude) first.\" with a Configure… button and Generate is disabled"
when: "Radical Forge is opened"
---
