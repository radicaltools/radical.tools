---
id: "eb6c6cfa-6891-4a27-b3ea-19817dff3a6d"
type: "scenario"
label: "A view switch keeps what views show"
given: "a model of 20,000 elements and a view whose filter gives its requirements"
metrics: |
  test(packages/common/tests/largeModels.test.ts › a model of 20,000 elements › keeps what a view shows when only the places of its elements changed) passed
  test(packages/common/tests/largeModels.test.ts › a model of 20,000 elements › keeps what a view shows across an edit its filters do not read) passed
then: "after the move the view's elements are the same answer, not worked out again; after the change of type and the addition they are worked out again and are right; after the rename the view filtered by type keeps its answer and the one filtered by text is worked out again"
when: "an element is moved, as opening a view moves its elements to their places there; then an element changes type; then one is added; and, for a view filtered by type and one filtered by text, an element is renamed"
---
