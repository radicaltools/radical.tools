---
id: "9aaa492d-1c75-48be-b014-a82a5803c4f6"
type: "scenario"
label: "Ordered column across groups"
given: "a column that keeps its order, whose elements sit in different groups placed against that order"
tests: "packages/layout/tests/constraints.test.ts › an ordered column across groups › puts the groups in the order the column asks for, and stands (item 219)"
then: "the groups move into the order the column asks for, the members stand in that order on one vertical line, and enforcing it again changes nothing"
when: "the alignment is enforced, and again after the result is read back"
---
