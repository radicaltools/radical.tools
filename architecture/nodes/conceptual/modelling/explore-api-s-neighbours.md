---
id: "8b5f67dc-9162-4c9a-af8e-f6c5787ed043"
type: "scenario"
label: "Explore API's neighbours"
given: "the bookstore model in Designer with API selected"
tests: |
  packages/ui/tests/exploreView.test.ts › an explore view
  apps/e2e/tests/studio/explore.spec.ts › Explore from here grows by + and by a level
then: "a view \"Explore: API\" opens first in the list with API alone; the + adds Web App, Orders DB and Payment Provider inside their frames beside API without moving it, and its count goes to none; + 1 level adds Customer; the saved document and the undo history are unchanged"
when: "the user chooses Explore from here, clicks API's +, then + 1 level"
---
