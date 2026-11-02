---
id: "f4f15583-00a5-40f6-a1ef-657f4d749b30"
type: "scenario"
label: "FIND for agents"
given: "a model with an element whose description says ledger"
metrics: "test(packages/common/tests/search.test.ts › FIND in the query language returns the hits as Quick Search finds them) passed"
then: "the element is returned with its kind, id, label and the words around ledger; only views come back for v:"
when: "search_model is called with FIND ledger, and with FIND v: and a view's name"
---
