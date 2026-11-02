---
id: "6a410138-d231-4ccf-98cb-78185404dff7"
type: "fitness-fn"
label: "Tests outside the model tests"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

The tests of the scenarios that bind tests outside the model: packages/common/tests/verifies.test.ts, apps/cli/src/verify.test.ts, the setup, harden and MCP tests, and the Studio card's.
