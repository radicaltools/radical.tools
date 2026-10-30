---
id: "08929203-71a8-4000-9dbe-8cb5f0ff93cd"
type: "scenario"
label: "Agent opens a folded group"
given: "a group folded on the model and a view that lists it and its child"
metrics: |
  test(packages/common/tests/aiSequenceTools.test.ts › update_view › shows elements open or folded in the view only, over their fold on the model) passed
  test(apps/mcp/src/folderModel.test.ts › long Smart Layout runs › opens and folds a container on a view round its middle, making room as Studio does (item 172)) passed
  test(packages/ui/tests/viewCollapse.test.ts › the assistant folding and opening a container on the view shown › does what the −/+ does: folds to the middle and opens round it (item 172)) passed
then: "the view records it as opened over the model's fold, then as folded; the container folds to its middle and opens round it with room made, over MCP and through Studio's assistant alike; opening an element the model shows open needs no override; an unknown id is refused"
when: "update_view opens it, then folds it, in that view"
---
