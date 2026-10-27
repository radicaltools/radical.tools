---
id: "a4d8d593-831c-4d4d-afe1-e2dd3984633c"
type: "fitness-fn"
label: "Setup and doctor tests"
category: "structural"
tests: |
  apps/cli/src/setup.test.ts
  apps/cli/src/doctor.test.ts
  apps/cli/src/launcher.test.ts
threshold: "The three suites pass in CI"
---

apps/cli/src/setup.test.ts (radical setup in a temporary repository and home: each agent's configuration written and merged, the new model, the hooks, the questions). apps/cli/src/doctor.test.ts (radical doctor against a stand-in MCP server, a missing command and another version). apps/cli/src/launcher.test.ts (radical.sh against a stand-in Node.js mirror: a node too old skipped, the build downloaded once and checked against its sum, the CLI and the MCP server run through npx). CI runs radical.cmd on windows-latest.
