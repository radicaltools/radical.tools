---
id: "004e02d0-ffc6-4232-8652-dba0a2895635"
type: "requirement"
label: "Verified MCP npm release"
action: "GitHub Actions shall run the workspace boundary check, the type-check and the tests, pack the MCP server and verify that the packed archive installs and runs outside the monorepo, keep that archive as a build artifact, and publish that same archive to npm with provenance only when the run is not a dry run and runs on main."
ears_type: "event-driven"
rationale: "mcp-publish.yml is manual (workflow_dispatch) with dry-run on by default; a real publish from another ref fails at its first step; npm publish uses OIDC Trusted Publishing, so no npm token is stored. Evidence: .github/workflows/mcp-publish.yml, apps/mcp/scripts/test-package.mjs, apps/mcp/package.json"
trigger: "the maintainer runs the Publish MCP to npm workflow"
---
