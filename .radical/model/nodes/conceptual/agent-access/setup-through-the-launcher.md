---
id: "82850ee4-5c85-407c-8597-af1a919434ab"
type: "requirement"
label: "Setup through the launcher"
action: "the CLI shall pin the launcher to its own version, make radical.sh executable, and write each agent's entry to start the MCP server through the launcher (sh radical.sh mcp, or radical.cmd mcp on Windows), naming the launcher by its path from the top of the repository in a project file and by its absolute path in a user file"
ears_type: "event-driven"
rationale: "The agents then find Node.js as the launcher does, a downloaded one included, and one line in the launcher sets the version of the CLI and of every agent's server. Evidence: apps/cli/src/agentConfig.ts (entryFor), apps/cli/src/setup.ts"
trigger: "radical setup runs through the launcher"
---
