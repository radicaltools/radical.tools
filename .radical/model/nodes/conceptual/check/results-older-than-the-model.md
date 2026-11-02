---
id: "4e8f5201-ab83-4f55-9ce2-516242645fec"
type: "scenario"
label: "Results older than the model"
given: "a model naming a test that the test results kept beside it, read eight days ago, do not have, a test they have that failed, and a goal on requirements verified"
then: "against the kept results the missing test is a warning saying the results were read eight days ago and the goal is a warning, while the failed test stays an error; with fresh reports the missing test and the goal are errors"
when: "the model is checked against those results as the Inspector checks it, and again with the same cases as fresh reports"
---
