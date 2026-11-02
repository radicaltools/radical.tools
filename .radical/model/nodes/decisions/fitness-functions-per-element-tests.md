---
id: "5ff405f3-c874-4504-9dc4-1748263e32b8"
type: "fitness-fn"
label: "Fitness functions per element tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
metrics: |
  test(apps/cli/src/sense.test.ts › radical sense run › runs a sensor of radical.sensors.json once per element its decision constrains, with the context) passed
  test(packages/common/tests/fitnessPerElement.test.ts) passed
  test(.radical/sensors/sensors.test.mjs) passed
scope: "atomic"
trigger: "pull-request"
---

apps/cli/src/sense.test.ts (per-element runs with --context, unknown sensors) and packages/common/tests/fitnessPerElement.test.ts (per-element evaluation, a fetched standard). .radical/sensors/sensors.test.mjs checks this repository's own use: every element a fitness function measures with a sensor of .radical/sensors/sensors.json has a place in .radical/sensors/elements.mjs, and each sensor names an element it has none for.
