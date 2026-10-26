---
id: "c8628aca-fcef-4e06-835f-352a3c8d85be"
type: "scenario"
label: "Find in a view"
given: "a canvas with three elements named Order something and others"
tests: |
  apps/e2e/tests/studio/find.spec.ts › Cmd+F finds in the view: the rest dimmed, Enter and Shift+Enter step through the hits
  apps/e2e/tests/studio/find.spec.ts › Cmd+F on a table dims the rows not found, and on a wiki goes to its search box
then: "the bar counts 3, the other elements are dimmed, each Enter selects the next hit and Shift+Enter the one before; Escape closes the bar with the hit selected; on a table the rows not found are dimmed, and on a wiki Cmd/Ctrl+F goes to its search box"
when: "the user presses Cmd/Ctrl+F, types order, presses Enter twice and Shift+Enter, then Escape"
---
