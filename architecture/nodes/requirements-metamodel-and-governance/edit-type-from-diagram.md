---
id: "744bfc65-db93-49a4-ad84-98a4a9447e6f"
type: "requirement"
label: "Edit type from diagram"
action: "The system shall switch to the List tab and open and scroll to that type's card."
ears_type: "event-driven"
rationale: "The diagram is read-only, so editing must be one click away. Evidence: apps/studio/src/renderer/src/components/MetamodelEditor.tsx:118-129,557-565; apps/studio/src/renderer/src/components/metamodel/MetamodelInspector.tsx:94; apps/studio/src/renderer/src/components/metamodel/MetamodelDiagram.tsx:625-627; apps/e2e/tests/studio/metamodel-diagram.spec.ts:115-118"
trigger: "the user presses \"Edit type\" in the diagram side panel or double-clicks a type box"
---
