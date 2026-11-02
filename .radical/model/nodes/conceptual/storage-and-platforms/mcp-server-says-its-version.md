---
id: "26b29eee-7617-4f5c-815a-031e2178bc36"
type: "requirement"
label: "MCP server says its version"
action: "The MCP server shall give the product version of its build, with its commit unless it was built from the release tag, as it gives it in the MCP handshake."
ears_type: "event-driven"
rationale: "The handshake's serverInfo reaches the MCP client, not the agent, so an agent could not say which server it talks to. get_model_summary is the call every agent makes first."
trigger: "an agent calls get_model_summary, or someone runs radical-mcp --version"
---
