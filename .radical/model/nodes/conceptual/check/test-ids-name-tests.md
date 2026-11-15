---
id: "b742b26c-56cd-4097-9475-56b040264e92"
type: "requirement"
label: "Test ids name tests"
action: "read the test each test id (bound in .radical/radical.json, or named by a test() condition of a scenario's or fitness function's metrics) names as file › title, as Vitest and Playwright print it, leaving out the project printed before the file ([chromium] › , [1/4] , |unit| ) and the line and column after it (:2:3); match the file by path suffix and the title to the test whose describe blocks and title it ends, else to every test of the describe block it starts, a line without a title to every test in that file or directory, and skip blank lines and lines starting with #"
ears_type: "ubiquitous"
rationale: "One id format that Vitest and Playwright print, matched the same way in the CLI and Studio's Inspector. A test bound as a runner prints it, with its project and line, was not found in the report (F-0144, round 211–220). Evidence: packages/common/src/check/reports.ts (parseTestIds, findTests, fileMatches, RUNNER_PREFIX, FILE_LOCATION), packages/common/src/check/metrics.ts (parseCondition), packages/common/tests/checkReports.test.ts"
---
