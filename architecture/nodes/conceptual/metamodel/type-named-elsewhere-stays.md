---
id: "7e64cb6a-56bb-4258-9a62-a186c71b1ddf"
type: "scenario"
label: "Type named elsewhere stays"
given: "a custom type Service no live element uses, named by a viewpoint that makes a view per Service, by a viewpoint's or a view's filter, or held by an element of milestone As-is"
tests: |
  packages/common/tests/relationEndpoints.test.ts › deleting a type a viewpoint or a view names
  packages/common/tests/aiDocumentTools.test.ts › metamodel tools › refuse to delete a type a viewpoint or a view names
  packages/common/tests/aiDocumentTools.test.ts › metamodel tools › refuse to delete a type a milestone still holds elements or relations of
  packages/ui/tests/typesInUse.test.ts › Deleting a type from the metamodel › is refused while a milestone holds an element or a relation of that type
  packages/ui/tests/typesInUse.test.ts › Deleting a type from the metamodel › counts the live model while a milestone is open
then: "the delete is refused, naming the viewpoint, view or milestone to change first, and the metamodel keeps the type; Validation lists a viewpoint that names a type the metamodel lacks"
when: "the user deletes it in the metamodel editor, or an agent calls delete_node_type (or delete_relation_type for a relation type a filter follows), also while a milestone is open"
---
