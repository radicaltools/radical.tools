---
id: "21c6ec47-bbd8-4a32-a901-c142239cf6f1"
type: "fitness-fn"
label: "One product version"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
metrics: "test(tools/release.test.mjs › the CLI, the MCP server, the Desktop app and the VS Code extension carry one version) passed"
scope: "atomic"
trigger: "pull-request"
---

tools/release.test.mjs reads the package.json of the CLI, the MCP server, the Desktop app and the VS Code extension and fails when they carry different versions; npm test and CI run it. The workflows a v* tag starts check the same with node tools/release.mjs check.

Threshold: The four released packages carry one version on every commit
