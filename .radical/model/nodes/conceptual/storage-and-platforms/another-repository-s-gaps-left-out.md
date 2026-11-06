---
id: "6b8ab2de-7f49-4c58-bd48-bee37578dcb4"
type: "scenario"
label: "Another repository's gaps left out"
given: "a model with requirement A, satisfied by an element this repository builds, with a passing test, and requirement B, satisfied by an element it does not build, with none; .radical/radical.json names the model"
then: "nothing is found about B or its element, and requirements-verified is 100%, 1 of 1"
when: "radical check runs with the test report"
---
