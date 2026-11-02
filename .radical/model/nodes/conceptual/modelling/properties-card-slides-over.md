---
id: "5c6482e6-b9fc-422c-a8e4-aeba0fdcf27e"
type: "scenario"
label: "Properties card slides over"
given: "the bookstore System Context view in Designer"
then: "the card shows Payment Provider's name and type over the canvas while the canvas keeps its size; it goes with the selection and with ✕ (the element staying selected), stays closed on Customer's click and opens on its double-click; the description reads as Markdown, is edited on a click and saved; Delete element is the card's last section and deletes the element; the card is 100 px wider, also after the reload, which selects Payment Provider again as the route names it; the head holds Explore and ✕, in Designer and in Viewer, Explore opening Explore: Payment Provider, and Viewer's card has no Delete"
when: "the user double-clicks Payment Provider, clicks the empty canvas, double-clicks it again and closes the card with ✕, clicks Customer, then double-clicks it; edits Payment Provider's description in the card and deletes it with Delete element at the bottom of the card; drags the card's edge 100 px wider, reloads and double-clicks Payment Provider; on another run explores from Payment Provider with Explore on the card's head, then double-clicks it in Viewer"
---
