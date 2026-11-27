---
id: "568c3709-5675-4bc0-80d3-0f1b6e1c686e"
type: "scenario"
label: "Gate check keeps nothing"
given: "a model folder with test results and measurements kept beside it, a failing test report and a metrics file"
then: "it reports the failure and exits 1, and .state/test-results.json and .state/measurements.json are as they were; without --no-keep both are written"
when: "radical check runs with --report and --metrics and --no-keep"
---
