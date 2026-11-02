---
id: "7ca1b1cc-494d-4c89-b85a-0f9e12a35e1e"
type: "fitness-fn"
label: "Branch change tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
metrics: |
  test(packages/common/tests/branchChanges.test.ts) passed
  test(apps/cli/src/hooks.test.ts) passed
  test(apps/e2e/tests/studio/branch-changes.spec.ts) passed
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/branchChanges.test.ts (the base file format and its age, the changes and the counts per view, word diff, the status of each changed requirement and ADR from test evidence). apps/cli/src/hooks.test.ts (radical hooks install in a real git repository). apps/e2e/tests/studio/branch-changes.spec.ts (the toggle, the canvas marks, the counts per view, the card, the Inspector's This change, no base and an old base, in the browser on a folder model).

Threshold: All three suites pass in CI
