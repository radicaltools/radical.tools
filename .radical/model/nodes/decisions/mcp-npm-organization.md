---
id: "53a770a9-ce40-4708-aea8-7d5ef717d8f3"
type: "adr"
label: "MCP npm organization"
alternatives: "Keep @radical.tools/mcp under the original organization; publish and maintain both scopes indefinitely; remove the old package immediately, disrupting existing clients."
consequences: "The new name has independent versions and Trusted Publishing settings. Existing clients using @radical.tools/mcp continue using its published versions until their configuration changes. The executable remains radical-mcp. The verified archive is radicaltools-mcp-0.1.1.tgz, and later releases use the existing manual workflow from main."
context: "The public MCP package was released as @radical.tools/mcp. The maintainer now wants publication under the radicaltools npm organization, matching the GitHub organization. npm scopes are part of package identity and changing the scope requires a new publication."
date: "2026-10-12"
decision: "Publish the MCP server as @radicaltools/mcp, starting with version 0.1.1. This overrides only the npm organization and package name in Public MCP distribution; its bundling, runtime support, tarball verification and release workflow decisions still apply. Update workspace commands, lockfile and npx setup examples. Bootstrap this new package interactively from reviewed main, then configure its own GitHub Actions trusted publisher for radicaltools/radical.tools and mcp-publish.yml."
status: "accepted"
---
