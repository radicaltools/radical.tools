---
id: "b9381de5-9265-441f-b5b9-d3b638aa6ebc"
type: "requirement"
label: "Inspect a type or relation"
action: "The system shall zoom to it and what it connects to (showing only the sources and targets of a selected relation) and show its rules in the side panel: where the type can be placed, what it can contain, its relations out and in, and its properties."
ears_type: "event-driven"
rationale: "Answers \"where may an ADR go and what can it link to\" without reading every card. Evidence: apps/studio/src/renderer/src/components/metamodel/MetamodelDiagram.tsx:227-249,485-570,621-624; apps/studio/src/renderer/src/components/metamodel/MetamodelInspector.tsx:70-197; apps/e2e/tests/studio/metamodel-diagram.spec.ts:69-108"
trigger: "the user selects a type or a relation in the metamodel diagram"
---
