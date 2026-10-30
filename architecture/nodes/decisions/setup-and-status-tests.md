---
id: "a4d8d593-831c-4d4d-afe1-e2dd3984633c"
type: "fitness-fn"
label: "Setup and status tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
metrics: |
  test(apps/cli/src/setup.test.ts) passed
  test(apps/cli/src/status.test.ts) passed
  test(apps/cli/src/launcher.test.ts) passed
scope: "atomic"
trigger: "pull-request"
---

apps/cli/src/setup.test.ts (radical setup in a temporary repository and home: each agent's configuration written and merged, the new model, the hooks, the questions). apps/cli/src/status.test.ts (radical setup --status against a stand-in MCP server, a missing command and another version). apps/cli/src/launcher.test.ts (radical.sh against a stand-in Node.js mirror: a node too old skipped, the build downloaded once and checked against its sum, the CLI and the MCP server run through npx). CI runs radical.cmd on windows-latest.

Threshold: The three suites pass in CI
