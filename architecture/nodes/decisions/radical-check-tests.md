---
id: "54513b8e-ffe3-4af1-81c7-65eefa7481b7"
type: "fitness-fn"
label: "radical check tests"
category: "structural"
tests: |
  packages/common/tests/check.test.ts
  packages/common/tests/checkReports.test.ts
  apps/cli/src/cli.test.ts
threshold: "All suites pass in CI (npm test)"
---

packages/common/tests/check.test.ts runs every rule on folders written with serializeToMdFolder (folder files, metamodel issues with the validator's severities, completeness, stale references, config, baseline and ratchet, output). packages/common/tests/checkReports.test.ts reads Vitest, Playwright and JUnit reports, matches test ids to tests, describe blocks, files and directories, and works out the evidence. apps/cli/src/cli.test.ts runs the `radical` command in a temporary working directory: exit statuses 0, 1 and 2, radical-check.json, --format json, --ratchet rewriting the config, --report and --evidence, --list-rules.
