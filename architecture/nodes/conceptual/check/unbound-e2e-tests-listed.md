---
id: "d8d3ca5f-1574-4e22-858f-f015f9999342"
type: "scenario"
label: "Unbound e2e tests listed"
given: "check.json includes apps/e2e/**, one scenario names a test of boot.spec.ts and a fitness function names the whole apps/e2e/tests"
metrics: "test(packages/common/tests/checkReports.test.ts › test-unbound) passed"
then: "one warning names boot.spec.ts with 3 of its 4 tests named by nothing and lists their titles; a describe block named by a scenario covers its tests, and excluded files are left out"
when: "radical check runs with the e2e report"
---
