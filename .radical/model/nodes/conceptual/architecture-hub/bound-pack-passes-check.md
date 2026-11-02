---
id: "06b33ae1-6aa9-472f-ace7-a5f63581fca2"
type: "scenario"
label: "Bound pack passes check"
given: "every concern pack of the catalogue, and for each a small model its trigger fires on"
metrics: |
  test(packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › every pack has a trigger that parses, questions and a connected slice) passed
  test(packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › every pack imported and bound passes radical check) passed
then: "its trigger parses, it has questions, and its slice is connected (requirements derive from the need, the fitness function implements the ADR marked with the pack's concern, scenarios verify the requirements); after the bound import the concern is no longer reported and no rule other than scenario-without-metrics and fitness-fn-without-metrics reports what the import brought in"
when: "the pack is validated, then imported into the model and bound to an element its trigger finds"
---
