---
id: "3fc618ce-c9ba-40a2-aa02-c02317439b4f"
type: "requirement"
label: "Toggle properties on boxes"
action: "The system shall show or hide the property rows on every type box, listing at most six properties and a \"+N more\" row."
ears_type: "event-driven"
rationale: "Properties help when reviewing fields but make the picture large. Evidence: apps/studio/src/renderer/src/components/metamodel/metamodelGraph.ts:82-114; apps/studio/src/renderer/src/components/metamodel/MetamodelDiagram.tsx:84-99,276-284; apps/e2e/tests/studio/metamodel-diagram.spec.ts:41-45,65-66"
trigger: "the user toggles \"Show properties on boxes\" in the diagram legend"
---
