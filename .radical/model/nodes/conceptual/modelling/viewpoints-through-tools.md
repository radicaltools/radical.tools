---
id: "4955a303-1c74-42b8-91d1-50f355c59004"
type: "scenario"
label: "Viewpoints through tools"
given: "an empty model on the Radical metamodel, over the shared tool catalogue"
then: "the view is a table of Traceability, then of Decisions, then of no viewpoint; Needs is a wiki viewpoint with its description, the metamodel stays the preset and its message lists viewpoints; the view follows to a table and keeps it after the delete; each wrong call is refused with the reason; the replies of delete_viewpoint and upsert_viewpoint name the views per element they delete, and the engine says what each change takes: a group's views, or the elements picked for a view that becomes a group"
when: "an agent creates a view with viewpoint Traceability, moves it to decisions, detaches it with null, adds the viewpoint Needs from a wiki view, makes the view one of it, changes the viewpoint to a table and deletes it; and tries an unknown viewpoint, a viewpoint with a kind, a taken name, an unknown node type and the flow kind; and deletes a viewpoint whose views are a group, and takes the subject away from another"
---
