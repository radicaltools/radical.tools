---
id: "c726cead-d627-4003-847d-5135db126279"
type: "scenario"
label: "Move with Parent field"
given: "a canvas shows Payment Provider beside Bookstore"
tests: "apps/e2e/tests/studio/editing.spec.ts › the Parent field moves an element into its new parent, and refuses a loop"
then: "Payment Provider becomes a child of Bookstore and lies inside its frame, and the second move is refused with \"Cannot move a node into itself or one of its descendants.\" leaving Bookstore at the root"
when: "the user picks Bookstore as Payment Provider's Parent, then picks Payment Provider as Bookstore's Parent"
---
