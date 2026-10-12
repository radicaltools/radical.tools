---
id: "c681fcc0-29ea-49b4-827a-2b2db809a513"
type: "container"
label: "MCP server"
technology: "Node.js, MCP over stdio"
---

Local MCP server (apps/mcp) that gives coding agents one Markdown model folder as tools: summary with modelling and metamodel rules, search, current issues, elements, views, sequences, presentations, milestones, metamodel edits, Smart Layout and Radical Forge. Every write is validated against the metamodel. Distributed as the public @radicaltools/mcp npm package with the radical-mcp executable. Its build bundles the private Radical workspaces and ships the Hub catalogue; only the MCP SDK and ELK.js remain runtime dependencies. The first release under this npm scope is published interactively after review, and .github/workflows/mcp-publish.yml supports later manual releases from main using npm Trusted Publishing (OIDC).
