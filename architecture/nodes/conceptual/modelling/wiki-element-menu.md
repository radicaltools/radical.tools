---
id: "26c26304-2413-4582-85cf-33f38996efff"
type: "scenario"
label: "Wiki element menu"
given: "the Payments Service wiki page in Designer"
tests: "apps/e2e/tests/studio/wiki.spec.ts › wiki › the element menu adds a relationship in two steps, edits one and opens the facts"
then: "the page reads \"Uses Accounts Service\" and an Interacts relation is saved; Edit relationship opens the editor of the Event Bus relation; Edit facts opens Core Banking Platform with its facts editable until Done editing facts"
when: "the user adds a Uses relationship to Accounts Service from the element menu, right-clicks Event Bus in a relation sentence, and right-clicks Core Banking Platform in the list of pages"
---
