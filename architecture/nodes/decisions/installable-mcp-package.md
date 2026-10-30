---
id: "3015c7f5-e82a-4a9a-b0fb-b9990a5ef6eb"
type: "fitness-fn"
label: "Installable MCP package"
category: "structural"
---

apps/mcp/scripts/test-package.mjs runs npm pack on apps/mcp and checks the archive: it holds dist/index.js, README.md, LICENSE and the bundled Hub catalogue (dist/hub-catalogue), nothing outside dist/ but package.json, README.md and LICENSE, and no @radical/* runtime dependency. It installs the archive with production dependencies only into a temporary project outside the monorepo, checks the executable (shebang, radical-mcp bin) and the MIT license, and starts radical-mcp over stdio with npm exec --offline: the MCP handshake must report the package version, and get_model_summary, add_node, add_relation, smart_layout (which loads the code-split ELK chunk), forge_start, forge_clarify (which must find a concept of the bundled Hub catalogue) and get_issues must succeed; a second start must find the written elements and radical.md. ci.yml runs it on every pull request on Linux and Windows with Node 20 and 24; mcp-publish.yml runs it again (Linux, Node 24) with --out-dir and publishes the archive it verified.

Threshold: npm run test:package -w ./apps/mcp passes on Linux and Windows with Node 20 and 24 on every pull request, and on Linux with Node 24 in the publish run before npm publish.
