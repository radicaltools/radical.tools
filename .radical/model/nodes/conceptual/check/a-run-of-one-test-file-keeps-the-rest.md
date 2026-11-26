---
id: "70b20ba0-13b3-4b3e-9e0a-a68fd957a8f5"
type: "scenario"
label: "A run of one test file keeps the rest"
given: "a model whose scenarios name tests in two files, and test results kept beside it from a run in which both files passed"
then: "the check reports the failed test and no test of the other file as one that did not run, says that it kept the results of the other file and since when, and the results kept beside the model hold both files, the first as the report has it, with the count of those kept; the results of CI then replace them whole"
when: "radical check reads with --report a report that has one of the files only, in which a test failed, and then results of CI are read with --from-ci"
---
