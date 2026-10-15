---
id: "cd5565a9-eb4e-469d-8851-fd29329f786c"
type: "scenario"
label: "Row holds through layout"
gherkin: ""
given: "the bookstore fixture is open on All elements and Customer, API (inside Bookstore) and Payment Provider are kept in a row"
tests: "apps/e2e/tests/studio/alignment.spec.ts › a row on All elements holds through a drag, Smart Layout and a reload"
then: "after each step the three drawn centres are on one horizontal line, the document stores the alignment, and Smart Layout's rearrangement takes the pins off"
when: "the user drags Payment Provider down, sends the Orders DB far off (so that Smart Layout has a better layout to offer than the one on screen), runs Smart Layout and reopens the document"
---
