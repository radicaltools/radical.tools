---
id: "d3fb618d-8759-4bda-88d9-db7c9ef3968c"
type: "scenario"
label: "Every adapter meets the contract"
given: "every adapter in the registry and its fixture"
metrics: "test(apps/cli/src/sensors/contract.test.ts) passed"
then: "each writes a valid radical-metrics/1 file and none reads a threshold or fails on a value"
when: "the contract test runs"
---
