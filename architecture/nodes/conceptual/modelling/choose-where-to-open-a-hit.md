---
id: "6e6500cc-ce29-4901-bf0c-22ec3415c52d"
type: "scenario"
label: "Choose where to open a hit"
given: "Orders DB, shown by the Containers and Place Order Flow views and the Element Table"
tests: "apps/e2e/tests/studio/search.spec.ts › a hit lists its views as a next step, and opens in the one picked"
then: "the hit shows 3 views; the list Open Orders DB in shows Containers first, then the others and All elements; the left arrow goes back to the results; Enter opens Element Table with Orders DB selected"
when: "the user searches for it in Quick Search, presses the right arrow, then the left arrow, then the right arrow again, moves down to Element Table and presses Enter"
---
