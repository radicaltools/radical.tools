---
id: "55916a7c-c16b-44ed-ba45-a12bfb8bc811"
type: "scenario"
label: "Plus rows of a large table"
given: "a model of 20,000 elements and a table of needs, the requirements derived from them and the scenarios verifying those"
metrics: "test(packages/common/tests/largeModels.test.ts › a model of 20,000 elements › works out the + rows of a table of 1,000 rows within 200 ms) passed"
then: "each requirement offers a + row, and the fastest of the three takes under 200 ms"
when: "the + rows under 1,000 requirements are worked out, three times"
---
