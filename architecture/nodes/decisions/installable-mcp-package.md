---
id: "3015c7f5-e82a-4a9a-b0fb-b9990a5ef6eb"
type: "fitness-fn"
label: "Installable MCP package"
category: "structural"
threshold: "npm run test:package -w ./apps/mcp passes on Node 20 and 24 on Linux and Windows before publishing."
---

apps/mcp/scripts/test-package.mjs packs the app and installs its archive with production dependencies in a temporary project outside the monorepo. It validates allowed files, executable and license, package-version handshake, model writes and reload, Smart Layout chunks, and the bundled Forge Hub catalogue. ci.yml runs it on Linux and Windows with Node 20 and 24. mcp-publish.yml publishes the exact archive that passed this check.
