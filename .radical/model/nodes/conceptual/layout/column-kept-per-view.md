---
id: "81bd3b46-1763-482f-ad83-56520f86b909"
type: "scenario"
label: "Column kept per view"
given: "two elements are selected on a named view"
metrics: "test(apps/e2e/tests/studio/alignment.spec.ts › a column in a view stays in that view and can be removed from the canvas) passed"
then: "their centres line up vertically and the alignment is stored for that view only, not for All elements; after the removal no alignment guide is drawn"
when: "the user chooses Align → Keep in a column, then selects one of them and presses Remove column alignment"
---
