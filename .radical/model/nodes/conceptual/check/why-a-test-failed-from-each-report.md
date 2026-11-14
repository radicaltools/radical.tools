---
id: "9a061ac3-f35c-4e21-b688-0beaf8ffd012"
type: "scenario"
label: "Why a test failed, from each report"
given: "a Vitest JSON report with task locations, a Playwright JSON report and a JUnit XML report, each with a failing and a passing test"
then: "each failing case keeps its failure message without colour codes, each case its duration in milliseconds, and the Vitest and Playwright cases their line"
when: "radical check reads them"
---
