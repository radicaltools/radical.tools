---
id: "2eeaefe7-2c95-4369-998c-f9d284019da3"
type: "requirement"
label: "Status finds what stops the agent"
action: "the CLI shall report Node's version, whether the folder reads as a model and whether the git hooks save its base, every agent configuration that holds a Radical MCP server with the folder it serves, a command or a folder that is not there and a server pinned to another version than the CLI's, then start each server configured for the folder as its agent would, call get_model_summary over stdio and report the version that answers; and exit 0 when nothing is broken, 1 when something is, 2 when it could not run"
ears_type: "event-driven"
rationale: "An agent that cannot reach its tools says little about why. Starting the server with the agent's own command, arguments and environment finds a missing node, a moved folder or an npx download that fails. Evidence: apps/cli/src/status.ts"
trigger: "radical status runs"
---
