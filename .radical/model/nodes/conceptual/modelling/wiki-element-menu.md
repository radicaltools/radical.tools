---
id: "26c26304-2413-4582-85cf-33f38996efff"
type: "scenario"
label: "Wiki element menu"
given: "the Payments Service wiki page in Designer"
metrics: |
  test(apps/e2e/tests/studio/wiki.spec.ts › wiki › the element menu adds a relationship in the picker, edits one and opens the facts) passed
  test(apps/e2e/tests/studio/wiki.spec.ts › the wiki keeps the metamodel) passed
then: "the page reads \"Uses Accounts Service\" and an Interacts relation is saved; Edit relationship opens the editor of the Event Bus relation; Edit facts opens Core Banking Platform with its facts editable until Done editing facts; the relation's type is offered only among the types that fit, never none; Part of is offered only from a part to an aggregate root; Delete asks with the canvas's dialog and Undo brings everything back"
when: "the user adds a Uses relationship to Accounts Service in the element menu's Add or link…, right-clicks Event Bus in a relation sentence, and right-clicks Core Banking Platform in the list of pages; changes a relation's type; adds a relationship between entities; and deletes an element from its page, then presses Undo"
---
