---
id: "c5ca829c-e00f-4bc6-a7f3-6b4512cbdd66"
type: "scenario"
label: "Inspector from a link"
given: "a folder model whose check report has a failed test, open in the Inspector"
tests: "apps/e2e/tests/studio/inspector.spec.ts › a deep link opens the Inspector at once, and only with all it reads"
then: "the Inspector is drawn from the first paint, never Designer's canvas, and it shows only the whole check with the test results (one error), never a partial report"
when: "the page is reloaded from its link to the Inspector"
---
