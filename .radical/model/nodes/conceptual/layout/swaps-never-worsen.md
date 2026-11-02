---
id: "e73395f3-417e-438a-b161-85e6030e0a0c"
type: "scenario"
label: "Swaps never worsen"
given: "a row of elements whose relations cross"
metrics: "test(packages/layout/tests/layoutPipeline.test.ts › minimizeCrossings › never increases the crossing/overdraw cost) passed"
then: "some swaps are kept and the crossing and overdraw cost goes down"
when: "sibling swaps are tried"
---
