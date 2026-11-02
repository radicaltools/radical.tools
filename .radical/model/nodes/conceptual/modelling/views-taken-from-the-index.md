---
id: "97289399-c157-407d-b94d-e99536ce6540"
type: "scenario"
label: "Views taken from the index"
given: "a model of 20,000 elements and an index of a view of its requirements, with one requirement left out of it"
metrics: |
  test(packages/common/tests/largeModels.test.ts › the view index › gives a view of a model of the same structure its elements without running its filter) passed
  test(packages/common/tests/largeModels.test.ts › the view index › keeps no view whose filter reads names or properties) passed
  test(packages/common/tests/largeModels.test.ts › the view index › sees the same structure in elements and relations listed in another order) passed
then: "the view leaves out what the index leaves out, also after the rename; after the change of type its filter runs and finds what the index left out; views reading a name or a property get no key; the structure is the same in any order"
when: "the view is asked for its elements as a model opened anew asks; then after a rename; then after a requirement became a scenario; and views whose filters read a name or a property are keyed; and the model's elements and relations are listed in another order"
---
