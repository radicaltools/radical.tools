---
id: "7e64cb6a-56bb-4258-9a62-a186c71b1ddf"
type: "scenario"
label: "Type named elsewhere stays"
given: "a custom type Service no live element uses, named by a viewpoint that makes a view per Service, by a viewpoint's or a view's filter, or held by an element of milestone As-is"
then: "the delete is refused, naming the viewpoint, view or milestone to change first, and the metamodel keeps the type; Validation lists a viewpoint that names a type the metamodel lacks"
when: "the user deletes it in the metamodel editor, or an agent calls delete_node_type (or delete_relation_type for a relation type a filter follows), also while a milestone is open"
---
