---
id: "d2ce82e2-7370-40e1-8df9-b3bab6b5a84a"
type: "fitness-fn"
label: "Federation tests"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
metrics: |
  test(packages/common/tests/federation.test.ts) passed
  test(apps/cli/src/federation.test.ts) passed
  test(apps/mcp/src/folderModel.test.ts › federation) passed
  test(apps/e2e/tests/studio/federation.spec.ts) passed
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/federation.test.ts (compose, the fetched file read with the model, nothing of theirs written, read-only model operations), apps/cli/src/federation.test.ts (fetch, transitive dependencies and the federated check on real git repositories), apps/mcp/src/folderModel.test.ts › federation (the MCP server reads the other models, refuses edits to them and writes only its own), apps/e2e/tests/studio/federation.spec.ts (marked and read-only in Studio).

Threshold: All suites pass in CI
