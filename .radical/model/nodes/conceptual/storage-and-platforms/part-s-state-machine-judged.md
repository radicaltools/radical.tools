---
id: "72d984fe-14e4-460e-975b-febc52359b74"
type: "scenario"
label: "Part's state machine judged"
given: "an element this repository builds that implements state machine M, an element it does not build that implements state machine N, and a scenario that verifies each machine, neither with a passing test; .radical/radical.json names the model"
then: "the scenario of M is found without a passing test, and nothing is found about the scenario of N"
when: "radical check runs with the test report"
---
