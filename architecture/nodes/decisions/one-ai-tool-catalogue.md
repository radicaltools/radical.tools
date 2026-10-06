---
id: "8a2fb157-4bb6-4043-9748-42152f8cb625"
type: "adr"
label: "One AI tool catalogue"
alternatives: "Tools implemented only in apps/mcp."
consequences: "A new tool needs a facade method in both facades (Studio's store and the headless createModelFacade); the facade parity test proves they behave the same."
context: "Studio's AI chat, Radical Forge and the MCP server all edit the model through tools. Separate implementations would drift apart."
date: "2026-10-05"
decision: "Define every tool once in @radical/common (src/ai/tools): definition plus handler over a model facade. Studio's chat gets every tool and Forge leaves out the metamodel and presentation groups. The MCP server serves the catalogue without the canvas-only set_active_view and focus_node and the destructive reset_diagram, and adds get_model_summary and smart_layout."
status: "accepted"
---
