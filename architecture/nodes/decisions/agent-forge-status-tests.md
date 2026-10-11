---
id: "6a96ccd6-4055-4dad-bcaa-a52032726bed"
type: "fitness-fn"
label: "Agent Forge status tests"
category: "structural"
threshold: "All three suites pass in CI"
---

packages/common/tests/forgeRunStatus.test.ts (the file format, phases, current stage, client names), apps/mcp/src/forge.test.ts › tells Studio where the run stands and › marks an unfinished run closed (over stdio: the status after each step, finished on forge_finish, closed when the client goes away) and apps/e2e/tests/studio/folders.spec.ts › an agent's Forge run on the folder (the button pulses with the stage, the read-only view follows the file, paused when closed).
