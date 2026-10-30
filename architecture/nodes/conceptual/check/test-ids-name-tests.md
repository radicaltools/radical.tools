---
id: "b742b26c-56cd-4097-9475-56b040264e92"
type: "requirement"
label: "Test ids name tests"
action: "read the test each test() condition of a scenario's or fitness function's metrics names as file › title, matching the file by path suffix and the title to the test whose describe blocks and title it ends, else to every test of the describe block it starts, a line without a title to every test in that file or directory, and skip blank lines and lines starting with #"
ears_type: "ubiquitous"
rationale: "One id format that Vitest and Playwright print, matched the same way in the CLI and Studio's Inspector. Evidence: packages/common/src/check/reports.ts (parseTestIds, findTests, fileMatches), packages/common/src/check/metrics.ts (parseCondition), packages/common/tests/checkReports.test.ts"
---
