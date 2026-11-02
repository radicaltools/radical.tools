---
id: "21c6ec47-bbd8-4a32-a901-c142239cf6f1"
type: "fitness-fn"
label: "One product version"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
measure: "product-version"
metrics: |
  product-version.exit_code == 0
  test(tools/release.test.mjs › the CLI, the MCP server, the Desktop app and the VS Code extension carry one version) passed
scope: "atomic"
trigger: "pull-request"
---

Measured for each element ADR Product and format versioning constrains: radical sense run runs the repository's sensor product-version (.radical/sensors/sensors.json, .radical/sensors/product-version.mjs) once per element, with the element in --context. It fails when the element's released package (the CLI apps/cli, the MCP server apps/mcp, Studio and the Desktop app apps/studio, the VS Code extension apps/vscode) carries another version than the other released packages, and when the element is an internal package (@radical/common) that is not private, so not released on its own. tools/release.test.mjs tests the check of the release script, which the workflows a v* tag starts run with node tools/release.mjs check.

Threshold: every released package carries the product version on every pull request
