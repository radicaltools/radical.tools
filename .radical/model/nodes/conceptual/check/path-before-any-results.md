---
id: "0e7438b6-5cdf-4a02-853c-beef68c39ac5"
type: "scenario"
label: "Path before any results"
given: "a folder model with a scenario bound to a test, and no test results"
then: "the path lists the bound test with no outcome yet, and says that a scenario names no check only of one with nothing bound"
when: "the path of the scenario's requirement is asked for, with get_trace, radical check --trace or after radical verify binds the test"
---
