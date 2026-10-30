---
id: "043f0d51-a4cb-47de-a571-81912563acd7"
type: "fitness-fn"
label: "Navigation history tests"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
metrics: |
  test(apps/studio/tests/route.test.ts) passed
  test(apps/studio/tests/navHistory.test.ts) passed
  test(apps/e2e/tests/studio/history.spec.ts) passed
scope: "atomic"
trigger: "pull-request"
---

apps/studio/tests/route.test.ts (every part of a place round-trips through the route in one form), apps/studio/tests/navHistory.test.ts (the list of pushed routes: push, truncate ahead, move by the history state's index, labels), apps/e2e/tests/studio/history.spec.ts (back and forward through views, the Inspector's tabs and the selection, with the buttons and the keys; the History list).

Threshold: All three suites pass in CI
