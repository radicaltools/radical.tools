---
id: "0b3494f2-23c6-4541-b91b-b03a1c0de62f"
type: "requirement"
label: "Old test results warn"
action: "it shall report the test as a warning that names when the results were read and how old they are, not as an error, and report as warnings the goals that read test evidence, since the test may have been added after those results; radical check given fresh reports with --report keeps the error."
ears_type: "event-driven"
rationale: "The kept results are a run of the past: a model that named 173 tests added in the eight days since its last radical check --report showed 173 errors and three unmet goals in the Inspector, none of them wrong in the model or the code (the user, 2026-10-31). The gate reads the run's own reports and still fails on a test that is gone. Evidence: packages/common/src/check/rules.ts (testsReadAt, asOf), packages/common/src/check/goals.ts, packages/common/src/check/index.ts, apps/studio/src/renderer/src/persistence/inspector.ts"
trigger: "the Inspector checks the model against the test results kept beside it, and a test the model names is not in them"
---
