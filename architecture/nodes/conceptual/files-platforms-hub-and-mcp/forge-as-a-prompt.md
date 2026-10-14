---
id: "14b16244-47d2-4b41-b74d-1997d20f743d"
type: "requirement"
label: "Forge as a prompt"
action: "offer a forge prompt (a slash command in clients that show prompts) that takes an optional description and asks the agent to run Radical Forge step by step, or, without a description, to ask for one or offer the needs already in the model"
ears_type: "ubiquitous"
rationale: "One command starts the whole Forge procedure from the agent's chat. Evidence: apps/mcp/src/index.ts (registerPrompt 'forge', forgePrompt), apps/mcp/src/forge.ts (FORGE_PROCEDURE), apps/mcp/src/forge.test.ts › starts from an existing need and offers the flow as a prompt"
---
