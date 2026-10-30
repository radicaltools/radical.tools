---
id: "894df0fa-09e0-4e71-8573-ec67b6582773"
type: "scenario"
label: "Common test reports read"
given: "a Vitest or Jest JSON, a Playwright JSON and a JUnit XML report, a file that is no report, and a directory of reports"
metrics: |
  test(packages/common/tests/checkReports.test.ts › test reports › reads a Vitest or Jest JSON report) passed
  test(packages/common/tests/checkReports.test.ts › test reports › reads a Playwright JSON report: a spec fails when one of its projects did) passed
  test(packages/common/tests/checkReports.test.ts › test reports › reads a JUnit XML report) passed
  test(packages/common/tests/checkReports.test.ts › test reports › refuses what is no report) passed
  test(apps/cli/src/cli.test.ts › radical check › reads test reports, fails on a failed test, and writes the evidence) passed
then: "each test case is read with its file, title path and status, a Playwright spec failing in one project fails, a file that is no report is refused, and every report in a directory is read"
when: "radical check reads them with --report"
---
