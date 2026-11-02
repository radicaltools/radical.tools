---
id: "40f5f410-1b03-4da4-b246-3c25be36c44e"
type: "requirement"
label: "Save a view as a viewpoint"
action: "Studio shall keep the view's view type and chain in the metamodel under that name, replacing the view type and chain of the viewpoint of that name or adding one, make the view one of it, offer it under + New view and in every view's Viewpoint list, and list each viewpoint in the metamodel editor with its view type, its chain in words and how many views are of it, where its name, view type and description can be changed and it can be deleted."
ears_type: "event-driven"
rationale: "A viewpoint is set up where a chain is built, in a view's Filter, and maintained with the rest of the metamodel. Saving does not copy a built-in metamodel: the viewpoints are the document's own. Evidence: packages/common/src/viewpoints.ts (saveAsViewpoint, withViewpoint, withoutViewpoint, chainSummary), packages/ui/src/components/ViewPipelinePanel.tsx (ViewpointRow), apps/studio/src/renderer/src/components/MetamodelEditor.tsx (ViewpointCard); manual#viewpoints, manual#metamodel"
trigger: "the user saves a view's filter as a viewpoint under a name, or edits a viewpoint in the metamodel editor"
---
