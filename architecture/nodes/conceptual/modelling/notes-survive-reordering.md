---
id: "aae7183a-ae5d-45c4-b7ae-b0daf40d163a"
type: "scenario"
label: "Notes survive reordering"
given: "a sequence whose first step has the note 'validate cart'"
metrics: "test(packages/ui/tests/sequences.test.ts › preserves descriptions when reordering steps) passed"
then: "the note 'validate cart' is shown on the second step"
when: "the user moves the first step down"
---
