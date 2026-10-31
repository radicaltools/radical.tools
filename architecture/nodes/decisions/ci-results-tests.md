---
id: "64951276-e875-4deb-b423-96b553aa2a30"
type: "fitness-fn"
label: "CI results tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
metrics: |
  test(apps/cli/src/ciResults.test.ts) passed
  test(apps/cli/src/hooks.test.ts) passed
scope: "atomic"
trigger: "pull-request"
---

apps/cli/src/ciResults.test.ts (radical check --from-ci in a real git repository against a stand-in gh). apps/cli/src/hooks.test.ts (the hook line).
