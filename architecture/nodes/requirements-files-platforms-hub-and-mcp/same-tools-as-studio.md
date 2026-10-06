---
id: "e8d2846a-cd7e-40d7-8837-7f17aa7cbfa2"
type: "requirement"
label: "Same tools as Studio"
action: "The MCP server shall offer get_model_summary plus the shared AI tool catalogue without the Studio-only tools set_active_view, focus_node and reset_diagram."
ears_type: "ubiquitous"
rationale: "One tool catalogue keeps Studio chat, Forge and agents consistent. Evidence: apps/mcp/src/folderModel.ts:17-38; apps/mcp/src/folderModel.test.ts ('lists and calls tools over stdio'); manual#mcp"
---
