---
id: "d8aa7883-ecda-4b18-ab27-452c13dac438"
type: "requirement"
label: "Agent on another version"
action: "Studio shall say once per model and version which version the agent's MCP server and Studio are, which is older, and that builds of different versions may read and write the model differently."
ears_type: "event-driven"
rationale: "Claude Desktop runs the MCP server from its own worktree, and an npx install keeps its version; an older server can drop what a newer Studio writes. Builds of one version with other commits count as the same version."
trigger: "Studio loads a change an agent wrote to the model folder through an MCP server of another product version than Studio's, as the server records it in .radical/agent-activity.json"
---
