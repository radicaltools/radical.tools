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
  packages/ui/tests/views.test.ts › addView / addNodeToView / removeNodeFromView › a group of views per element and its views take no elements by hand
  packages/ui/tests/milestoneViewGroups.test.ts › an element of a view per element, edited in a milestone
  packages/ui/tests/milestoneViewGroups.test.ts › a view per element opened for the first time in a milestone
  apps/mcp/src/catalogueTools.test.ts › MCP document tools › lays out each view per element as it is made: with its group, and for an element added later
  apps/e2e/tests/studio/viewpoints.spec.ts › a viewpoint that draws one element makes a group with a view of each, which a new element joins
  apps/studio/tests/quickSearchPick.test.ts › opens on its first view, as a click on it in the list does
  apps/studio/tests/quickSearchPick.test.ts › is never the view a pick, Show on canvas or the choice of views opens
  apps/e2e/tests/studio/search.spec.ts › Quick Search opens a group of views per element on its first view
  packages/ui/tests/viewpointGroupActive.test.ts › the view shown becomes a group of views per element › by its viewpoint in View properties: the group opens its first view and keeps no canvas
  packages/ui/tests/viewpointGroupActive.test.ts › the view shown becomes a group of views per element › by its viewpoint getting a subject in the metamodel editor: the same
  packages/common/tests/viewpoints.test.ts › what a change of viewpoints takes from the views per element › a group keeps no places and no camera of a canvas
  packages/common/tests/viewpoints.test.ts › viewpoint tools › say when update_view makes a view a group of views per element, and that its picked elements go
  apps/e2e/tests/studio/viewpoints.spec.ts › a view given a viewpoint of one element asks first, then opens the group's first view, also after a reload
then: "the list holds one card State machine with 2 views, Order and Payment, opened on Order with its states only, laid out by Smart Layout without the not-laid-out notice, and no Viewpoint list, View type or Detach of its own; Hide from view is not offered there; the group's properties say it holds one view per State Machine, with no View type or Viewpoint list, and offer to delete it with its views; the move puts the group and both its views in States; the new machine adds a third view to the group at once; the click hides the views; no view is made of the external machine, a deleted or external one loses its view, the views follow the group's folder and go when it is detached or deleted; a view's name follows its element's, also after the name was emptied on the way; the agent's delete, retype and set_view_nodes of one of the group's views and its retype and detach of the group are refused; a rename or delete in a milestone, discarded, leaves the views as they were, and propagated renames or removes them; a view first opened in a milestone is not laid out there, and is laid out back on live; over MCP each view the group makes is laid out as it is made; the view given such a viewpoint asks first, then opens the group's first view, keeps no positions or camera of its own, and shows the same after a reload, and update_view says the view became a group and its picked elements went"
when: "the user opens + New view and picks State machine, tries to hide a state from Order's view, opens the group's properties, moves its first view to the folder States, adds a state machine from the palette and clicks the group; and the engine and an agent keep groups in step as machines are added, deleted, renamed, made external and the group moves or is detached, an agent tries to delete, retype or list the elements of one of the group's views or retype or detach the group, and a machine is renamed or deleted, or a view of the group opened, while a milestone is shown; and a view with elements picked for it is given a viewpoint of one element, in View properties, through its viewpoint getting a subject in the metamodel editor, and with update_view"
---
