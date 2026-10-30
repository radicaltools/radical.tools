---
id: "06eee5f9-c487-42c2-ba0d-4ed1e7be74d1"
type: "scenario"
label: "Big Bank DSL imports whole"
given: "Structurizr workspaces with an enterprise block, relationships with { tags } blocks, a deployment environment, URLs in strings and # comments"
metrics: "test(packages/common/tests/structurizrDsl.test.ts › Structurizr DSL import) passed"
then: "every element and relationship comes in (Big Bank plc: 18 elements, 26 relationships), what follows a block is kept, and no comment becomes an element"
when: "they are imported"
---
