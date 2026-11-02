---
id: "004e02d0-ffc6-4232-8652-dba0a2895635"
type: "requirement"
label: "Verified MCP npm release"
action: "GitHub Actions shall run the workspace boundary check, the type-check and the tests, pack the MCP server and verify that the packed archive installs and runs outside the monorepo, keep that archive as a build artifact, and publish that same archive to npm with provenance only when the run is for a release tag whose commit is on main and whose version all four released packages carry, or is a manual run on main that is not a dry run; a version npm already has is skipped."
ears_type: "event-driven"
rationale: "npm-publish.yml starts on the release tag for the CLI and the MCP server together, and by hand (workflow_dispatch) for one package with dry-run on by default; a manual publish from another ref fails at its first step; npm publish uses OIDC Trusted Publishing, so no npm token is stored. Evidence: .github/workflows/npm-publish.yml, apps/mcp/scripts/test-package.mjs, apps/mcp/package.json"
trigger: "a release tag v<version> is pushed, or the maintainer runs the Publish to npm workflow for the MCP server"
---
