---
id: "94902c07-c30a-4988-b32e-d595d1f2d1b1"
type: "scenario"
label: "Sense cannot measure"
given: "a model folder"
metrics: "test(apps/cli/src/sense.test.ts › radical sense › exits 2 when it cannot measure) passed"
then: "it exits 2 with the reason and the registered adapters, and .radical/measurements.json is unchanged"
when: "radical sense names an unknown adapter, or an input file that is missing"
---
