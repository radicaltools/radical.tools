---
id: "2a531f9d-9c92-45d8-a12a-960c1a0a4011"
type: "scenario"
label: "Back and forward walk the places"
given: "the bookstore model on the System Context view"
tests: |
  apps/e2e/tests/studio/history.spec.ts › back and forward walk through the places, the selection too
  apps/studio/tests/navHistory.test.ts › navigation history
  apps/e2e/tests/studio/history.spec.ts › an exploration is named in the history, and Back passes over it once it is closed
  apps/studio/tests/route.test.ts › is named by its name, and Back and Forward pass over it once it is closed
then: "each press shows the place before or after: Designer on Containers, then System Context with the element selected, then Containers again with nothing selected; ‹ names the place it leads to, and at the first place it is greyed out"
when: "the user selects an element, opens the Containers view and switches to Viewer, then presses ‹, Alt+← and ›, and ‹ until the first place"
---
