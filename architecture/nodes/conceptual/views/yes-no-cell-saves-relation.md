---
id: "8b41a2c1-51dc-42a1-9ac0-95c2073f1979"
type: "scenario"
label: "Yes/no cell saves relation"
given: "the table view's Relations tab, with an Async yes/no property on relations"
tests: "apps/e2e/tests/studio/runs-13-24.spec.ts › a yes/no cell on the table's Relations tab saves the relation"
then: "the relation is saved with Async set"
when: "the user clicks the Async cell of the reads/writes relation"
---
