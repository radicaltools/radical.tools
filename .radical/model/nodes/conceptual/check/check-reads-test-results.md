---
id: "0a60f2fd-7b0b-4619-a53c-c665183377e5"
type: "requirement"
label: "Check reads test results"
action: "look up each test a scenario or fitness function names, report a failed, missing, skipped or not-run test with the requirements or ADRs it leaves unverified, and write each one's status to the evidence file when asked"
ears_type: "event-driven"
rationale: "A requirement counts as verified only when the tests behind it passed, not when someone said so. Evidence: packages/common/src/check/reports.ts, evidence.ts"
trigger: "`radical check` runs with test reports"
---
