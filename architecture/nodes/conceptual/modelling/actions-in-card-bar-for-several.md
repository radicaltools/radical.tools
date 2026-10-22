---
id: "63601b59-c707-4484-b696-5881747c8e5b"
type: "scenario"
label: "Actions in card, bar for several"
given: "the bookstore System Context view in Designer"
tests: |
  apps/e2e/tests/studio/properties-card.spec.ts › one element's actions are in its card, several elements' in a bar over the top of the canvas
  apps/e2e/tests/studio/properties-card.spec.ts › a relation's card changes its ends and hides it from the view
  apps/e2e/tests/studio/editing.spec.ts › Move to… with many parents stays in the window and scrolls
then: "the card's Actions hold Unwrap and Wrap into…, whose menu opens in the card and closes; Bookstore leaves the view; with two selected there is no card and a bar near the top of the canvas counts 2, and Delete removes both; Viewer shows no bar and no actions; charges card starts at Web App in the stored model and reads/writes is no longer drawn"
when: "the user selects Bookstore, opens Wrap into… in its card and closes it with Esc, hides Bookstore with Hide from view in the card, selects Customer and Shift-clicks Payment Provider and clicks Delete on the bar; then selects two elements and one in Viewer on Containers; on another run selects the relation charges card on Containers, changes its source to Web App and hides reads/writes from the view in its card"
---
