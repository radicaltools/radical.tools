---
id: "6112cae6-1cc4-4f66-b80a-35936be0f64d"
type: "requirement"
label: "Readable metamodel edges"
action: "The metamodel diagram shall draw a pair allowed in both directions as one two-headed edge, show a relation or nesting from a type to itself as a chip on its box, and name relation types allowed between any types in the legend instead of drawing them."
ears_type: "ubiquitous"
rationale: "Without these rules the governance preset becomes a hairball of loops and parallel lines. Evidence: apps/studio/src/renderer/src/components/metamodel/metamodelGraph.ts:9-20,160-194; apps/studio/src/renderer/src/components/metamodel/MetamodelDiagram.tsx:100-118,330-332; apps/studio/tests/metamodelGraph.test.ts:41-56; apps/e2e/tests/studio/metamodel-diagram.spec.ts:37-38"
---
