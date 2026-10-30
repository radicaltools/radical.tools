---
id: "5c198c28-9162-451f-b85b-b8dc5ef6eb98"
type: "scenario"
label: "Chain before its elements"
given: "the bookstore on the Radical metamodel, with no need and no requirement, its Element Table open"
metrics: "test(apps/e2e/tests/studio/view-pipeline.spec.ts › a chain is built from the metamodel before its elements, and the table then adds them) passed"
then: "both levels are offered and taken with no element yet, the table is empty, then the need shows at the top and the requirement under it, and the need's wizard opens"
when: "the user starts the Filter with Need, adds the level Refined into → Requirement, then adds a need from the + row at the end and a requirement from the + row under it, and opens the need's wizard from its row"
---
