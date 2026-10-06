---
id: "bdb3b41d-0e1a-4995-86c0-01584c7395af"
type: "requirement"
label: "Filter metamodel diagram edges"
action: "The system shall draw only the remaining edges and only the types they connect, and, when only Contains is hidden, still link a type no relation reaches to its allowed parents."
ears_type: "event-driven"
rationale: "The picture can be narrowed to one concern, e.g. what Constrains connects. Evidence: apps/studio/src/renderer/src/components/metamodel/metamodelGraph.ts:196-213; apps/studio/src/renderer/src/components/metamodel/MetamodelDiagram.tsx:262-335; apps/studio/tests/metamodelGraph.test.ts:57-110; apps/e2e/tests/studio/metamodel-diagram.spec.ts:47-62"
trigger: "the user hides Contains or relation types in the diagram legend (one by one, or with all / none)"
---
