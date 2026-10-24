---
id: "78feb6b6-5cc2-4817-8e1c-06c9362bbdc6"
type: "scenario"
label: "Margin by type"
given: "a view with loose ADRs and loose requirements among linked elements"
tests: "packages/layout/tests/tidy/craft.test.ts › loose elements gather in a column per type"
then: "the margin holds a column of ADRs and a column of requirements, each in name order"
when: "Smart Layout tidies it"
---
