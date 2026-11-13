---
id: "fc8ca3f9-74c2-42df-ab7c-3a11fcbf2e8b"
type: "container"
label: "Radical benchmark"
technology: "Node.js, Claude Code headless"
---

apps/bench, a private workspace, never published: the harness (harness/run.mjs) runs one arm of the benchmark step by step, each step a fresh headless Claude Code session in a work folder outside the repository, with a product owner simulated by a model over MCP and hidden tests that score the step through an adapter a model writes. The Radical arm gets the published CLI and MCP server, or with --radical-local the build of a checkout of this monorepo. The system under test is systems/shop (brief, steps, hidden details and tests); reference/shop is a reference implementation the adapter is tried on. Results are written to runs/ and results/, which git ignores.
