---
id: "4955a303-1c74-42b8-91d1-50f355c59004"
type: "scenario"
label: "Viewpoints through tools"
given: "an empty model on the Radical metamodel, over the shared tool catalogue"
metrics: |
  test(packages/common/tests/viewpoints.test.ts › viewpoint tools › create a view of a viewpoint by id or name, detach it, and refuse what does not fit) passed
  test(packages/common/tests/viewpoints.test.ts › viewpoint tools › add a viewpoint from a view, change it so its views follow, and delete it, without copying the preset) passed
  test(packages/common/tests/viewpoints.test.ts › viewpoint tools › name the views per element they delete: delete_viewpoint, and upsert_viewpoint taking a subject away) passed
  test(packages/common/tests/viewpoints.test.ts › what a change of viewpoints takes from the views per element › deleting the viewpoint of a group: its views; a view becoming a group: the elements picked for it) passed
then: "the view is a table of Traceability, then of Decisions, then of no viewpoint; Needs is a wiki viewpoint with its description, the metamodel stays the preset and its message lists viewpoints; the view follows to a table and keeps it after the delete; each wrong call is refused with the reason; the replies of delete_viewpoint and upsert_viewpoint name the views per element they delete, and the engine says what each change takes: a group's views, or the elements picked for a view that becomes a group"
when: "an agent creates a view with viewpoint Traceability, moves it to decisions, detaches it with null, adds the viewpoint Needs from a wiki view, makes the view one of it, changes the viewpoint to a table and deletes it; and tries an unknown viewpoint, a viewpoint with a kind, a taken name, an unknown node type and the flow kind; and deletes a viewpoint whose views are a group, and takes the subject away from another"
---
