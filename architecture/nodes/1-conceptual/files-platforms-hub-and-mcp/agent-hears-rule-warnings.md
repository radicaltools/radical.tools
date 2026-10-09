---
id: "2b55d8ee-277e-4ffe-8927-6ddfc8f9519e"
type: "requirement"
label: "Agent hears rule warnings"
action: "The MCP server shall return the warnings the change brought in with its result (up to eight), and get_issues shall list every error and warning the model has now, as Studio's Issues panel does."
ears_type: "event-driven"
rationale: "Statechart rules and dangling references are warnings, which never refuse a write; without them an agent would leave a machine with no initial state and report it done. Evidence: apps/mcp/src/folderModel.ts (commit, get_issues); apps/mcp/src/folderModel.test.ts ('state machines over MCP')"
trigger: "an agent changes the model through the MCP server, or calls get_issues"
---
