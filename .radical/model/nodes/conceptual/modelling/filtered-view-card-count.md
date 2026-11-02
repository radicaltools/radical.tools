---
id: "ce664891-1354-4256-abd5-b618eb9a64b3"
type: "scenario"
label: "Filtered view card count"
given: "the Fintech sample's Requirements Register table view, which lists no elements"
metrics: "test(apps/e2e/tests/studio/view-pipeline.spec.ts › needs → requirements → scenarios, built in the Filter panel, shown as a tree in the table) passed"
then: "its card in the Views panel says how many nodes the chain shows, not All nodes"
when: "the user builds the chain needs → requirements → scenarios in its Filter"
---
