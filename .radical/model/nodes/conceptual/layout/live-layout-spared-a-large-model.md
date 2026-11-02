---
id: "785cc9bd-7281-4baf-a53c-537a8514103d"
type: "scenario"
label: "Live layout spared a large model"
given: "a live layout given 1,001 related elements; and WebCoLa's pairing heap with 300 values, and with 1,000,000 sub-heaps under its root"
then: "the live layout builds no layout, moves nothing and throws nothing; the heap is the same after every pop with either merge; the million pop in order without running out of stack"
when: "the live layout starts and an element is dragged; the 300 values are popped with the heap's merge and with WebCoLa's own; the least 1,000 of the million are popped"
---
