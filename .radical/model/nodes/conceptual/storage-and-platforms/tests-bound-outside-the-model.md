---
id: "02904c28-afae-45e5-aab7-2f56c55d2aac"
type: "scenario"
label: "Tests bound outside the model"
given: "a model with requirements an element of the repository satisfies and their scenarios, one bound to a passing test in .radical/radical.json, one to a failing test, one naming a test in its Metrics, one with nothing, and a repository element mapping"
then: "the bound scenarios pass and fail by their tests, the one naming a test in Metrics is counted and warned about (test-in-model), the one with nothing is warned about (scenario-not-verified-here), and a bound test missing from the reports is test-not-found"
when: "radical check runs with the test reports"
---
