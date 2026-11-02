---
id: "d6a72e00-4931-4875-afa2-a773391fd137"
type: "scenario"
label: "Static and dynamic results"
given: "a fitness function with only fixed limits, one with a limit against a baseline, and one with tests alone"
metrics: "test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › reads the result as static from limits and as dynamic from a baseline) passed"
then: "the first is static, the second dynamic, the third has none, and the summary of each shows it"
when: "their results are read"
---
