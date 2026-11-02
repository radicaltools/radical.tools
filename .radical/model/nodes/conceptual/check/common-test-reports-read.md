---
id: "894df0fa-09e0-4e71-8573-ec67b6582773"
type: "scenario"
label: "Common test reports read"
given: "a Vitest or Jest JSON, a Playwright JSON and a JUnit XML report, a file that is no report, and a directory of reports"
then: "each test case is read with its file, title path and status, a Playwright spec failing in one project fails, a file that is no report is refused, and every report in a directory is read"
when: "radical check reads them with --report"
---
