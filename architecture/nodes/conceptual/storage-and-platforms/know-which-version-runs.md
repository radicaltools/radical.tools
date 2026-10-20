---
id: "3b58e5d4-8d5c-4626-934d-6fbf154105fa"
type: "need"
label: "Know which version runs"
kind: "stakeholder-note"
source: "Product owner, 2026-10-20"
---

"Work on versioning the product now; I mean the cli, mcp and studio packages. I would like the MCP server to be able to say which version it is, the CLI should have a --version option, and Studio should show its version somewhere. What else is missing?"
Settled after the proposal: one version for the whole product (the proposed ADR on versioning had chosen a version per package; it is changed to one), shown in Studio in an About dialog from the menu; builds carry the commit they were built from; Studio warns when an agent writes through an MCP server of another version; a release cuts the changelog and tags v<version>. No separate CI check of the versions was asked for.
Translated from Polish.
