---
id: "6a96ccd6-4055-4dad-bcaa-a52032726bed"
type: "fitness-fn"
label: "Agent Forge status tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
metrics: |
  test(packages/common/tests/forgeRunStatus.test.ts) passed
  test(apps/mcp/src/forge.test.ts › tells Studio where the run stands through .radical/forge-run.json) passed
  test(apps/mcp/src/forge.test.ts › marks an unfinished run closed when the client goes away) passed
  test(apps/e2e/tests/studio/folders.spec.ts › an agent's Forge run on the folder makes the Forge button pulse and opens read only) passed
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/forgeRunStatus.test.ts (the file format, phases, current stage, client names), apps/mcp/src/forge.test.ts › tells Studio where the run stands and › marks an unfinished run closed (over stdio: the status after each step, finished on forge_finish, closed when the client goes away) and apps/e2e/tests/studio/folders.spec.ts › an agent's Forge run on the folder (the button pulses with the stage, the read-only view follows the file, paused when closed).

Threshold: All three suites pass in CI
