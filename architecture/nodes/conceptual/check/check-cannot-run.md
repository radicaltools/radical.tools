---
id: "0cf7f0c3-6eda-4dcf-b3a5-1f74ba5c8589"
type: "scenario"
label: "Check cannot run"
given: "a model folder in a working directory"
tests: |
  apps/cli/src/cli.test.ts › radical check › exits 2 when it cannot run
  apps/cli/src/cli.test.ts › radical check › exits 2 on a report it cannot read, or evidence without a report
then: "the exit status is 2, and the error output names the config or report it could not read"
when: "the user runs radical check on a missing folder, with an unknown format or option, a missing or unreadable config, a test report it cannot read, or --evidence without --report"
---
