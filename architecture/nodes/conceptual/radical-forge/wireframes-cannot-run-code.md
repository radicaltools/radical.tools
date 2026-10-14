---
id: "1900526a-7b23-4ac7-b19d-4bc2c9ad8fff"
type: "requirement"
label: "Wireframes cannot run code"
action: "The system shall strip them before storing the SVG and shall render wireframes only through an image data URI."
ears_type: "unwanted-behaviour"
rationale: "A model file shared with others must never execute or load content. Evidence: packages/common/src/wireframe.ts:1-37; packages/ui/src/components/nodes/C4Nodes.tsx:846-848; packages/common/tests/forgeWireframe.test.ts:68-92; manual#mockups"
unwanted_condition: "wireframe markup contains scripts, foreignObject, event handlers or external references"
---
