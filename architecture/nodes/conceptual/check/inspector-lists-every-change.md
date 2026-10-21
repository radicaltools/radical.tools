---
id: "bce2310f-1272-4996-bb91-1c683128a175"
type: "scenario"
label: "Inspector lists every change"
given: "a folder model with a base in which one element has another description, one is missing, one is extra, and a relation is new, and no test report"
tests: |
  apps/e2e/tests/studio/branch-changes.spec.ts › the Inspector lists every change since the base, and a click leads to the element
  apps/e2e/tests/studio/branch-changes.spec.ts › with a milestone open, the Inspector lists the changes of the model as it is
  apps/studio/tests/inspector.test.ts › going to an element › offers every wiki view with a page for the element, and opens the one chosen
then: "the Inspector opens on Changes, its first tab, counting 4 in its label; it names the base, says 3 elements changed: 1 added, 1 changed, 1 removed; 1 relation changed, and lists Added, Changed with description and Removed, one each, and the new relation; the click opens the element's properties card, read-only, with the added words of its description, Open wiki page greyed out as no wiki has a page for it, and Show on canvas offers the Architecture view, which opens with the element selected; a wiki with a page for an element is offered the same way; with the milestone shown the lists name the live model's elements and relation"
when: "the user opens the Inspector, goes to Implementation and back to Changes through All changes, and clicks the changed element; and opens the Inspector again with a milestone shown"
---
