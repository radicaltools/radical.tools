---
id: "78205392-99eb-48f8-8ea6-9cd6a648d86e"
type: "fitness-fn"
label: "Tidy layout tests"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
metrics: |
  test(packages/layout/tests/tidy/tidy.test.ts) passed
  test(packages/layout/tests/tidy/craft.test.ts) passed
scope: "atomic"
trigger: "pull-request"
---

Threshold: The suite passes in CI
