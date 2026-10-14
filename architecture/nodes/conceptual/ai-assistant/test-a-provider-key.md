---
id: "d1826e70-77c8-4ed8-9d28-86dcfb8bacfc"
type: "scenario"
label: "Test a provider key"
gherkin: "# Not covered by an automated test"
given: "the AI providers dialog is open on the OpenAI tab with a key pasted"
then: "a short ping is sent to OpenAI and the dialog shows \"✓ OK\" with the reply, or \"✕\" with the error text"
when: "the user presses Test connection"
---
