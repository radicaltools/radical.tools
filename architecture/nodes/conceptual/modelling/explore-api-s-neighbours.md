---
id: "8b5f67dc-9162-4c9a-af8e-f6c5787ed043"
type: "scenario"
label: "Explore API's neighbours"
given: "the bookstore model in Designer with API selected"
tests: |
  packages/ui/tests/exploreView.test.ts › an explore view
  apps/e2e/tests/studio/explore.spec.ts › Explore from here grows level by level from each +
then: "a view \"Explore: API\" opens first in the list with API alone, no frame drawn, and API's + menu open beside its +; Show all adds Web App, Orders DB, Payment Provider and Bookstore (its parent) a level below API, each with its relation to API and Bookstore with a dashed Contains arrow to API, and API's + gives way to a −; Web App's + adds Customer a level below with its relation to Web App; no relation within a level is drawn; nothing overlaps; the first Undo takes Customer away, the second the first level, Redo brings that level back, all on the exploration; API's − takes the four and Customer out again and shows API's + with 4; the saved document is unchanged"
when: "the user chooses Explore from here, chooses Show all in API's + menu, then Web App's +, presses Undo twice and Redo once, then clicks API's −"
---
