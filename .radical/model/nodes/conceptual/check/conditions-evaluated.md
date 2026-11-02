---
id: "7d8a1144-3f2b-4fde-a689-b510c2ae3dd2"
type: "scenario"
label: "Conditions evaluated"
given: "a scenario and a fitness function with metric and test() conditions, measurements and a test report"
metrics: |
  test(packages/common/tests/checkMetrics.test.ts › metric conditions) passed
  test(apps/cli/src/cli.test.ts › radical check › reads measurements given with --metrics, keeps them beside the model, and judges the conditions by them) passed
then: "each condition is passed or failed by the latest matching measurement or test, and each element's status follows its combine"
when: "radical check runs with --metrics and --report"
---
