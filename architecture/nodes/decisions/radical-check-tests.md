---
id: "54513b8e-ffe3-4af1-81c7-65eefa7481b7"
type: "fitness-fn"
label: "radical check tests"
category: "structural"
tests: |
  packages/common/tests/check.test.ts
  packages/common/tests/checkReports.test.ts
  packages/common/tests/checkGoals.test.ts
  apps/cli/src/cli.test.ts
threshold: "All suites pass in CI (npm test)"
---

packages/common/tests/check.test.ts runs every rule on folders written with serializeToMdFolder (folder files, metamodel issues with the validator's severities, completeness, stale references, config, baseline and ratchet, output). packages/common/tests/checkReports.test.ts reads Vitest, Playwright and JUnit reports, matches test ids to tests, describe blocks, files and directories, and works out the evidence. packages/common/tests/checkGoals.test.ts measures the metrics with and without reports, fails a goal below its minimum as goal-unmet, reads goals from check.json, and says which changes of check.json loosen the gate. apps/cli/src/cli.test.ts runs the `radical` command in a temporary working directory: exit statuses 0, 1 and 2, radical-check.json, --format json, --ratchet rewriting the config, --report and --evidence, --list-rules.
