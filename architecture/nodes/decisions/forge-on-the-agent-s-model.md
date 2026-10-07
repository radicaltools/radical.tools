---
id: "1dcb9da1-2feb-417a-9529-49085beb63d4"
type: "adr"
label: "Forge on the agent's model"
alternatives: "MCP sampling, where the server asks the client's model for each step: few clients offer it, and the user could not answer the clarifying questions in between. A provider key in the server: a second place for keys, against ADR Bring your own AI key. Forge tools in the shared catalogue: Studio's chat would get a second Forge next to the wizard."
consequences: "A change to a Forge prompt reaches Studio and agents alike. The agent pays with its own model and needs no key in Studio. The run lives in the server's memory and is lost on restart (start again from the need). The server suggests from the catalogue it was built with, while Studio in production reads hub.radical.tools. Leaving the metamodel and presentation tools out of a stage is an instruction to the agent, not enforced."
context: "Radical Forge ran only in Studio, against the provider key entered there (ADR Bring your own AI key). People who work in Claude Code or Claude Desktop want the same flow on the model folder their agent already edits through the MCP server, and the server has no model of its own."
date: "2026-10-07"
decision: "The MCP server drives Forge with the client's model. The stages, stage prompts, clarifying-question prompt, Hub matches per stage, wireframe prompt and Hub import live in @radical/common (src/ai/forge, src/ai/systemPrompt.ts, src/hubImport.ts) and serve both Studio's wizard and the server. The server's forge_* tools hand the agent each step's prompt and keep the run (need, answers, summaries, what each stage added); the agent builds the model with the shared tool catalogue and asks the user the questions in its own chat. The forge_* tools are server-only, like get_model_summary, because Studio has the wizard instead. The server's build bundles the Hub catalogue from @radical/hub-catalogue."
status: "accepted"
---
