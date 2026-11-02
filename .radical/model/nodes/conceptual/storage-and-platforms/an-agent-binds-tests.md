---
id: "105c1efd-b898-431c-a02f-0fa75eb8d159"
type: "scenario"
label: "An agent binds tests"
given: "a repository whose model has a requirement its container satisfies and a scenario verifying it"
then: "the scenario is listed as one the repository verifies with no test, set_verification binds the tests, and get_changes names them"
when: "an agent calls get_verification, set_verification and get_changes"
---
