---
id: "b70815d1-520c-412c-937c-e9d6bd8178ea"
type: "fitness-fn"
label: "Continuous layout tests"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
metrics: |
  test(packages/ui/tests/continuousLayout.test.ts) passed
  test(apps/e2e/tests/studio/layout.spec.ts › continuous layout glides the view into place after an add) passed
scope: "atomic"
trigger: "pull-request"
---

Threshold: The suite passes in CI
