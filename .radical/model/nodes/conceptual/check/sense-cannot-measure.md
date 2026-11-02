---
id: "94902c07-c30a-4988-b32e-d595d1f2d1b1"
type: "scenario"
label: "Sense cannot measure"
given: "a model folder"
then: "it exits 2 with the reason and the registered adapters, and .state/measurements.json is unchanged"
when: "radical sense names an unknown adapter, or an input file that is missing"
---
