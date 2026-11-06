---
id: "33dc3858-1aba-40cc-8076-4bd3423eac98"
type: "scenario"
label: "Model checkout finds the mapping"
given: "a repository with a .radical/radical.json, and a clone of the model's repository at .radical/model"
then: "it reads and writes the repository's .radical/radical.json, and radical diff --since compares with a commit of the model's repository"
when: "the CLI reads the mapping from the model folder, and radical verify binds a test"
---
