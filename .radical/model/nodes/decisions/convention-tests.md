---
id: "b175f94b-0c1d-43c1-88bb-a20c84b096d3"
type: "fitness-fn"
label: "Convention tests"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
metrics: |
  test(packages/layout/tests/tidy/conventions.test.ts) passed
  test(packages/common/tests/layoutHints.test.ts) passed
scope: "atomic"
trigger: "pull-request"
---

Threshold: The suites pass in CI
