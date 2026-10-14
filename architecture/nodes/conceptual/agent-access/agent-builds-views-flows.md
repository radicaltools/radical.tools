---
id: "6fc4148b-5fca-4176-a20c-ae95416c05db"
type: "scenario"
label: "Agent builds views, flows"
given: "a model with a user, a shop and a bank joined by two relations"
tests: |
  packages/common/tests/aiSequenceTools.test.ts › sequence tools
  packages/common/tests/aiSequenceTools.test.ts › update_view
  packages/common/tests/aiToolCatalogue.test.ts › view tools › create_view sets kind via setViewKind
then: "the sequence and view are kept with the sequence's elements, the deleted sequence is unlinked from its view, the view gets its new name, kind and hidden relations, and a dynamic view without a sequence or a step on an unknown relation is refused"
when: "an agent records a sequence with a step note, creates a dynamic view that plays it, updates and deletes the sequence, and renames a view, changes its kind and hides a relation"
---
