---
id: "988af8a1-8378-4b7b-8d0b-ee93a11b4eb0"
type: "scenario"
label: "Search from a table"
given: "a model open on All elements, a table"
metrics: "test(apps/e2e/tests/studio/search.spec.ts › Quick Search is on every view, and a pick on a table selects the element) passed"
then: "the bar and its Forge button are there on the table, the element is selected and its properties card shows it; the bar is there on a wiki and a Warnier view too"
when: "the user types an element's name in Quick Search and picks it"
---
