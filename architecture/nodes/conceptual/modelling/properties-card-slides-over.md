---
id: "5c6482e6-b9fc-422c-a8e4-aeba0fdcf27e"
type: "scenario"
label: "Properties card slides over"
given: "the bookstore System Context view in Designer"
tests: |
  apps/e2e/tests/studio/properties-card.spec.ts › the properties card slides over the canvas on a selection and leaves its size alone
  apps/e2e/tests/studio/properties-card.spec.ts › a long field reads as Markdown and edits on a click
  apps/e2e/tests/studio/properties-card.spec.ts › the card is as wide as it was dragged, also after a reload
  apps/e2e/tests/studio/properties-card.spec.ts › after ✕ the card opens again for the element once something else was selected
  apps/e2e/tests/studio/properties-card.spec.ts › the card's head explores from the element, in Designer and Viewer, and Viewer cannot delete it
then: "the card shows Payment Provider's name and type over the canvas while the canvas keeps its size; it goes with the selection and with ✕ (the element staying selected) and comes back for Customer; the description reads as Markdown, is edited on a click and saved; Delete element is the card's last section and deletes the element; the card is 100 px wider, also after the reload, which selects Payment Provider again as the route names it; the head holds Explore and ✕, in Designer and in Viewer, Explore opening Explore: Payment Provider, and Viewer's card has no Delete"
when: "the user selects Payment Provider, clicks the empty canvas, selects it again and closes the card with ✕, selects Customer; edits Payment Provider's description in the card and deletes it with Delete element at the bottom of the card; drags the card's edge 100 px wider and reloads; on another run explores from Payment Provider with Explore on the card's head, then selects it in Viewer"
---
