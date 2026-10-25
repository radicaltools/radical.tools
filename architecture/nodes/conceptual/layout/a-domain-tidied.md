---
id: "d1b02db2-eed6-4891-964f-97d27944ade7"
type: "scenario"
label: "A domain tidied"
given: "an aggregate root entity with parts (part-of) and an entity it references, piled up"
tests: "packages/layout/tests/tidy/conventions.test.ts › a domain: the aggregate root above its parts"
then: "the root stands above its parts and the referenced entity beside, not below"
when: "Smart Layout tidies it"
---
