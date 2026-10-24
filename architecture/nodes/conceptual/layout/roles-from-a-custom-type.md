---
id: "3350cbe6-388e-4db3-82f8-e35b8fdb4336"
type: "scenario"
label: "Roles from a custom type"
given: "a document with a custom node type whose layout role is actor, and a document saved with a metamodel copy from before the hints"
tests: |
  packages/common/tests/layoutHints.test.ts › built-in hints reach a forked metamodel
  packages/layout/tests/tidy/conventions.test.ts › a custom type with the actor role
then: "the custom type is placed as an actor, and the old copy's person as well, by the preset's hint"
when: "Smart Layout tidies a view of each"
---
