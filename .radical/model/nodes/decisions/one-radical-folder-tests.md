---
id: "d8e021da-82af-4713-ad26-a3a3f456965b"
type: "fitness-fn"
label: "One .radical folder tests"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
metrics: |
  test(packages/node-files/tests/repositoryLayout.test.ts) passed
  test(packages/node-files/tests/stateDir.test.ts) passed
  test(apps/cli/src/setup.test.ts › radical setup › moves a repository laid out the old way into .radical) passed
scope: "atomic"
trigger: "pull-request"
---

packages/node-files/tests/repositoryLayout.test.ts (the model, the sensors and Crucible's plan found in .radical/ from any folder, the old layout as a fallback, what a pull left behind), packages/node-files/tests/stateDir.test.ts (state written to .state/, read from .radical/ while .state/ lacks it) and the setup test that moves a repository laid out the old way with git mv.
