---
id: "9e29c4f2-3e9b-4702-85e1-4e1bbe785f5d"
type: "scenario"
label: "Broken relations are refused"
given: "a domain with an aggregate root, a part of it and a second root; and a relation whose end has been removed from the model"
metrics: |
  test(packages/common/tests/relationEndpoints.test.ts › a part-of that breaks the aggregate rules › is refused: a root is part of none, a part belongs to a root, and to one only) passed
  test(packages/common/tests/relationEndpoints.test.ts › a relation whose end is not in the model › is refused, new or moved there) passed
then: "each is refused with its reason, and no relation is added or changed"
when: "a part-of is made from the root to the second root, to the part, and from the part to the second root; and a relation is added to, or moved onto, the removed element"
---
