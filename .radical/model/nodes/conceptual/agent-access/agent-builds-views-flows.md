---
id: "6fc4148b-5fca-4176-a20c-ae95416c05db"
type: "scenario"
label: "Agent builds views, flows"
given: "a model with a user, a shop and a bank joined by two relations"
metrics: |
  test(packages/common/tests/aiSequenceTools.test.ts › sequence tools) passed
  test(packages/common/tests/aiSequenceTools.test.ts › update_view) passed
  test(packages/common/tests/aiToolCatalogue.test.ts › view tools › create_view sets kind via setViewKind) passed
  test(packages/common/tests/aiDocumentTools.test.ts › a filter chain given to create_view or update_view) passed
then: "the sequence and view are kept with the sequence's elements, the deleted sequence is unlinked from its view, the view gets its new name, kind, hidden relations and folder, the listed views take their places in the given order, a chain that reads as written is taken, and a dynamic view without a sequence, a step on an unknown relation, an unknown view and a chain that would read otherwise than written are refused, saying what is wrong"
when: "an agent records a sequence with a step note, creates a dynamic view that plays it, updates and deletes the sequence, renames a view, changes its kind, hides a relation, puts views into folders and orders four views"
---
