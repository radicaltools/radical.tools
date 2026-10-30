---
id: "0cf7f0c3-6eda-4dcf-b3a5-1f74ba5c8589"
type: "scenario"
label: "Check cannot run"
given: "a model folder in a working directory"
metrics: |
  test(apps/cli/src/cli.test.ts › radical check › exits 2 when it cannot run) passed
  test(apps/cli/src/cli.test.ts › radical check › exits 2 on a report it cannot read, or evidence without a report) passed
  test(apps/cli/src/cli.test.ts › radical check › exits 2 on a report with no test case, naming it, and keeps the test results it had) passed
then: "the exit status is 2, the error output names the config or report it could not use, and the test results kept in .radical/test-results.json stay as they were"
when: "the user runs radical check on a missing folder, with an unknown format or option, a missing or unreadable config, a test report it cannot read, a report with no test case or a directory with no report, or --evidence without --report"
---
