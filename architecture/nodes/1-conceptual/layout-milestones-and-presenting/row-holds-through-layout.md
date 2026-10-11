---
id: "cd5565a9-eb4e-469d-8851-fd29329f786c"
type: "scenario"
label: "Row holds through layout"
gherkin: "# Covered by: apps/e2e/tests/studio/alignment.spec.ts › a row on All elements holds through a drag, Smart Layout and a reload"
given: "the bookstore fixture is open on All elements and Customer, API (inside Bookstore) and Payment Provider are kept in a row"
then: "after each step the three drawn centres are on one horizontal line and the document stores the alignment"
when: "the user drags Payment Provider down, runs Smart Layout and reopens the document"
---
