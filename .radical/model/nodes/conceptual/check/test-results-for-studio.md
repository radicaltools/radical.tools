---
id: "2c49cda5-7f31-4593-a0df-22db5e41941a"
type: "scenario"
label: "Test results for Studio"
given: "a model folder and a test report"
then: "the test cases, the reports, when they were read and the commit (and for results of CI the runs they come from) are kept in the model folder's .state/test-results.json beside a .gitignore holding *, and reading the file back drops what is no test case and a CI source it does not know"
when: "radical check runs with --report"
---
