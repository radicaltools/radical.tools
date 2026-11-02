---
id: "700904a2-cba3-4b18-aa76-522dd2f141e9"
type: "component"
label: "Stdio server"
technology: "@modelcontextprotocol/server"
---

apps/mcp/src/index.ts. Parses --folder (absolute or relative) and --metamodel (radical or c4, default radical), sends the server instructions (among them: call get_changes when asked to implement a change made in the model), registers every tool with a readOnlyHint and the forge prompt, checks calls against schemas without their type lists so types added elsewhere are accepted, forwards progress and cancellation, re-advertises the tool schemas after a metamodel change, names the client for the Forge run status, and exits with its client.
