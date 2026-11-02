---
id: "ddcde5a1-f0d3-4674-a527-88a6dbf97377"
type: "requirement"
label: "Read common test reports"
action: "read Vitest or Jest JSON, Playwright JSON (a spec failing in any project fails) and JUnit XML reports, each --report naming a file or a directory whose .json and .xml files it reads"
ears_type: "event-driven"
rationale: "No custom reporter is needed in CI. Evidence: packages/common/src/check/reports.ts (parseTestReport, parseJestJson, parsePlaywrightJson, parseJUnit), apps/cli/src/check.ts (reportFiles)"
trigger: "radical check runs with one or more --report options"
---
