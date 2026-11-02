---
id: "e8d74bec-159b-488c-9b19-d19aaf1ff3a6"
type: "scenario"
label: "Tests bound from the command line"
given: "a repository with a model of a scenario and a fitness function, and a model naming tests in its Metrics"
then: "radical.json holds the tests by element; setup moves the Metrics' tests into the file and leaves the metric conditions"
when: "radical verify binds, drops and lists tests, and radical setup runs on the second"
---
