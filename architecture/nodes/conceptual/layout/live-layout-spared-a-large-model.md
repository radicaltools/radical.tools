---
id: "785cc9bd-7281-4baf-a53c-537a8514103d"
type: "scenario"
label: "Live layout spared a large model"
given: "a live layout given 1,001 related elements; and WebCoLa's pairing heap with 300 values, and with 1,000,000 sub-heaps under its root"
metrics: |
  test(packages/layout/tests/liveColaRest.test.ts › Live layout physics: more elements than a canvas draws › lays out none of them, and builds none of its matrices) passed
  test(packages/layout/tests/webcolaHeap.test.ts › WebCoLa pairing heap › merges as WebCoLa did, so layouts stay the same) passed
  test(packages/layout/tests/webcolaHeap.test.ts › WebCoLa pairing heap › takes a heap of 1,000,000 sub-heaps without running out of stack) passed
then: "the live layout builds no layout, moves nothing and throws nothing; the heap is the same after every pop with either merge; the million pop in order without running out of stack"
when: "the live layout starts and an element is dragged; the 300 values are popped with the heap's merge and with WebCoLa's own; the least 1,000 of the million are popped"
---
