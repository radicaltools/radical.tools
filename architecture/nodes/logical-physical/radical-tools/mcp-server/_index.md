---
id: "c681fcc0-29ea-49b4-827a-2b2db809a513"
type: "container"
label: "MCP server"
technology: "Node.js, MCP over stdio"
---

Local MCP server (apps/mcp) that gives coding agents one Markdown model folder as tools: summary with modelling and metamodel rules, search, current issues, elements, views, sequences, presentations, milestones, metamodel edits, Smart Layout and Radical Forge. Every write is validated against the metamodel. Distributed as the public @radicaltools/mcp npm package with the radical-mcp executable. It says the product version of its build (with the commit unless it is the release tagged v<version>) in the MCP handshake, in get_model_summary (radicalVersion, with the folder format as modelFormat), with radical-mcp --version, and in .radical/agent-activity.json with each write, where Studio compares it with its own. Its build bundles the private Radical workspaces and ships the Hub catalogue; only the MCP SDK and ELK.js remain runtime dependencies. .github/workflows/npm-publish.yml publishes it on the release tag v<version> using npm Trusted Publishing (OIDC), a pre-release on the dist-tag next.
