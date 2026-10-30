---
id: "ea2fc097-9549-4ad2-a9b8-e73d2e601b71"
type: "scenario"
label: "Loose words find elements"
given: "elements named Źródło płatności and Payment Service, one with \"ledger\" in its description"
metrics: |
  test(packages/common/tests/search.test.ts › every word matches, in any order, without case or accents) passed
  test(packages/common/tests/search.test.ts › initials match an element's name) passed
  test(packages/common/tests/search.test.ts › the match is marked, and a hit in a description shows the words around it) passed
then: "each finds its element, the matched part is marked, and the description's hit shows the words around ledger"
when: "the search is zrodlo, service payment, ps or ledger"
---
