---
id: "bce2310f-1272-4996-bb91-1c683128a175"
type: "scenario"
label: "The chip lists the changes"
given: "a folder model with a base in which one element has another description, one is missing, one is extra, and a relation is new"
tests: "apps/e2e/tests/studio/branch-changes.spec.ts › the chip lists the changes, and a click shows the element"
then: "the list shows Added, Changed with description and Removed, one each, and the new relation; the click selects the element on the Architecture canvas and closes the list"
when: "the user turns on Changes on branch on All elements, opens the chip and clicks the changed element"
---
