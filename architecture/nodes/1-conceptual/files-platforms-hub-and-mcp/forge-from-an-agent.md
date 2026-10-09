---
id: "1cebc19f-7e5c-4d60-8220-057e294acd7e"
type: "requirement"
label: "Forge from an agent"
action: "The MCP server shall run Radical Forge's seven stages in the wizard's order, give the agent for each stage the same clarifying-question prompt, Hub matches and stage prompt that Studio sends its provider, and keep the run's need, answers, stage summaries and what each stage added."
ears_type: "event-driven"
rationale: "People who work in Claude Code or Claude Desktop get the same Forge with their agent's model, without a provider key in Studio. Evidence: apps/mcp/src/forge.ts; packages/common/src/ai/forge; apps/mcp/src/forge.test.ts; manual#mcp"
trigger: "an agent calls forge_start with a description or an existing need"
---
