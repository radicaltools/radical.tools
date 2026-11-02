---
id: "2da47ec9-900f-45a0-ab4d-b976ebf465e8"
type: "adr"
label: "Public MCP distribution"
alternatives: "Publish all private workspaces separately, requiring coordinated releases and exposed source entry points; ask users to clone and build the repository; store a long-lived npm publish token in GitHub secrets instead of OIDC."
consequences: "Users can run npx @radical.tools/mcp without source code or private workspace packages. Linux and Windows package checks cover Node 20 and 24. The package version is also the MCP handshake version. Maintainers must bump the MCP version in a reviewed pull request and configure its trusted publisher on npm before automated publication. Desktop tags never publish the MCP package."
context: "The MCP server could only run from a cloned monorepo. Its package was private and declared private @radical/* workspaces as runtime dependencies, so an npm consumer could not install it independently. Users need a public package under the radical.tools npm organization."
date: "2026-10-11"
decision: "Publish @radical.tools/mcp with the radical-mcp executable, explicit package files and Node 20.11+ support. Keep the private Radical workspaces as development dependencies bundled by tsup, and ship the Hub catalogue and MIT license. Test the actual tarball in a production-only installation outside the monorepo. Bootstrap the first version interactively with 2FA after review. Later releases use the manual mcp-publish.yml workflow from main, npm Trusted Publishing with OIDC, and provenance; its default is a dry run."
status: "accepted"
---
