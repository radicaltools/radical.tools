---
id: "c8628aca-fcef-4e06-835f-352a3c8d85be"
type: "scenario"
label: "Find in a view"
given: "the bookstore's Containers view, where Orders DB says orders by its name and the API and the customer by their descriptions"
tests: |
  apps/e2e/tests/studio/find.spec.ts › Cmd+F finds in the view: the rest dimmed, Enter and Shift+Enter step through the hits
  apps/e2e/tests/studio/find.spec.ts › Cmd+F on a table dims the rows not found, and on a wiki goes to its search box
then: "the bar says 3 found and then 1 of 3, 2 of 3, 1 of 3, selecting Orders DB first; the web app and the payment provider are dimmed, the bookstore holding hits is not; Escape closes the bar with Orders DB selected; on a table the rows found are marked, the others dimmed or, with Only the rows found, left out; on a wiki Cmd/Ctrl+F goes to its search box"
when: "the user presses Cmd/Ctrl+F, types orders, presses Enter twice and Shift+Enter, then Escape"
---
