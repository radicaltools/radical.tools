---
id: "58b63448-2aa5-4e8b-b45e-1e2135f48123"
type: "requirement"
label: "Agent Smart Layout"
action: "The MCP server shall run Smart Layout the way Studio does and store a view's result in that view's own positions."
ears_type: "event-driven"
rationale: "Agents can tidy the diagram after larger changes. Evidence: apps/mcp/src/folderModel.ts:235-274; apps/mcp/src/catalogueTools.test.ts ('lays out one view into its own positions'); manual#mcp"
trigger: "an agent calls smart_layout for All elements or one view"
---
