---
id: "c5ca829c-e00f-4bc6-a7f3-6b4512cbdd66"
type: "scenario"
label: "Inspector from a link"
given: "a folder model whose check report has a failed test, open with the Inspector on its Implementation tab"
then: "the Inspector is open on Implementation again, never left for the view, and it shows only the whole check with the test results (one finding to fix), never a partial report"
when: "the page is reloaded from its link to the Inspector"
---
