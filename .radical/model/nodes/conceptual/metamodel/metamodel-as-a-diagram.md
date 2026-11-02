---
id: "7df3211e-9b9d-430d-922e-d962da3049a3"
type: "requirement"
label: "Metamodel as a diagram"
action: "The system shall draw every node type as a box inside a frame per category, with a Contains edge from each allowed parent to its child and one labelled edge per relation type between each pair of types it connects."
ears_type: "event-driven"
rationale: "A picture shows the rules of the notation at a glance, which the list of cards cannot. Evidence: apps/studio/src/renderer/src/components/metamodel/metamodelGraph.ts:136-243; apps/studio/src/renderer/src/components/metamodel/MetamodelDiagram.tsx:604-646; apps/studio/src/renderer/src/components/MetamodelEditor.tsx:624-656; apps/e2e/tests/studio/metamodel-diagram.spec.ts:11-39"
trigger: "the user opens the Diagram tab of the metamodel editor"
---
