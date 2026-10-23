---
id: "3edbeb08-4922-44be-ae17-a1697d1ec206"
type: "scenario"
label: "A double-click opens the card"
given: "the bookstore's System Context and its Element Table"
tests: "apps/e2e/tests/studio/properties-card.spec.ts › a click selects, a double-click opens the card, which then follows the selection"
then: "the click selects Customer and opens no card; the double-click opens Customer's card, which then shows Bookstore on the click and closes with the selection on the empty spot; the relation's card opens on its double-click; in the table the click opens no card, F2 opens the name for writing, and the double-click opens the API's card"
when: "the user clicks Customer, double-clicks it, clicks Bookstore, clicks an empty spot, double-clicks the relation charges card; and in the table clicks the API row, presses F2, then double-clicks the row"
---
