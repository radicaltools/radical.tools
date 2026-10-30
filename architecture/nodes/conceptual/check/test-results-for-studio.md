---
id: "2c49cda5-7f31-4593-a0df-22db5e41941a"
type: "scenario"
label: "Test results for Studio"
given: "a model folder and a test report"
metrics: |
  test(apps/cli/src/cli.test.ts › radical check › reads test reports, fails on a failed test, and writes the evidence) passed
  test(packages/common/tests/checkReports.test.ts › radical check on a model in memory, and the files beside it › writes and reads the test results, dropping what is not a test case) passed
then: "the test cases, the reports and when they were read are kept in the model folder's .radical/test-results.json beside a .gitignore holding *, and reading the file back drops what is no test case"
when: "radical check runs with --report"
---
