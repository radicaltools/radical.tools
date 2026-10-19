---
id: "50c2a16b-d143-4661-90cd-7dbf42250cbd"
type: "scenario"
label: "A group of views of one element"
given: "a model on the Radical metamodel with the state machines Order and Payment, each with its states, and an external one"
tests: |
  packages/common/tests/viewpoints.test.ts › viewpoint subjects › keep a view to its element, in step with the viewpoint, and keep the chain on Detach
  packages/common/tests/viewpoints.test.ts › viewpoint subjects › make a group hold a view of each element that is not external, made and removed with the elements
  packages/common/tests/viewpoints.test.ts › viewpoint subjects › name a view after its element until it is renamed, and delete it with the element
  packages/common/tests/viewpoints.test.ts › viewpoint tools › make a group of views of one element, kept in step with the model, and refuse to delete or change one of its views
  apps/mcp/src/catalogueTools.test.ts › MCP document tools › lays out each view per element as it is made: with its group, and for an element added later
  apps/e2e/tests/studio/viewpoints.spec.ts › a viewpoint that draws one element makes a group with a view of each, which a new element joins
then: "the list holds one card State machine with 2 views, Order and Payment, opened on Order with its states only, laid out by Smart Layout without the not-laid-out notice, and no Viewpoint list, View type or Detach of its own; Hide from view is not offered there; the group's properties say it holds one view per State Machine, with no View type or Viewpoint list, and offer to delete it with its views; the move puts the group and both its views in States; the new machine adds a third view to the group at once; the click hides the views; no view is made of the external machine, a deleted or external one loses its view, the views follow the group's folder and go when it is detached or deleted; the agent's delete and retype of one of the group's views and its retype and detach of the group are refused; over MCP each view the group makes is laid out as it is made"
when: "the user opens + New view and picks State machine, tries to hide a state from Order's view, opens the group's properties, moves its first view to the folder States, adds a state machine from the palette and clicks the group; and the engine and an agent keep groups in step as machines are added, deleted, made external and the group moves or is detached, and an agent tries to delete or retype one of the group's views or retype or detach the group"
---
