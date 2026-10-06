---
id: "700904a2-cba3-4b18-aa76-522dd2f141e9"
type: "component"
label: "Stdio server"
technology: "@modelcontextprotocol/server"
---

apps/mcp/src/index.ts. Parses --folder and --metamodel, registers every catalogue tool with a readOnlyHint, forwards progress and cancellation, and re-advertises the tool schemas after a metamodel change. Exits with its client.
