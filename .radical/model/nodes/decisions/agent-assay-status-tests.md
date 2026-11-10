---
id: "726c8ae2-ec8e-44ad-915f-df503b2b0bf1"
type: "fitness-fn"
label: "Agent Assay status tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/assayRunStatus.test.ts (the file format, phases, current stage), apps/mcp/src/assayDomain.test.ts › tells Studio where the run stands, its stages inferred from the calls (the status after each call: stages inferred from plans, skipped stages, refusals, proposals, a later plan of an earlier stage, finished on assay_finish, closed when the server shuts down), apps/studio/tests/followAgent.test.ts (following stops once neither the Forge nor the Assay run goes on) and apps/e2e/tests/studio/folders.spec.ts › an agent's Assay run on the folder (the Assay button pulses with the stage, the read-only view follows the file, paused when closed, no button without a run).

Threshold: All four suites pass in CI
