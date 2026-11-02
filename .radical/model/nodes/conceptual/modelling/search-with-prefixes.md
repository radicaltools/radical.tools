---
id: "4b2b9d4a-f8d2-4ad2-91f3-06c0aaf3849c"
type: "scenario"
label: "Search with prefixes"
given: "a model whose elements and views share words"
metrics: |
  test(apps/e2e/tests/studio/search.spec.ts › prefixes narrow the search: @ to the view shown, in: to a view, type: and a property) passed
  test(packages/common/tests/search.test.ts › prefixes limit the kinds, the view, the types and the properties) passed
then: "only the elements of the view shown, of the named view, of the type or with the value, or only the views, are listed; the bar suggests the prefixes and the views, and Tab takes the first"
when: "the user types @, in:, type:, a property and its value, or v:, in front of the words"
---
