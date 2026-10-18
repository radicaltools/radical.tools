---
id: "58502df3-d03b-40a1-9239-fb6d5956e66b"
type: "scenario"
label: "Forge files into the Radical structure"
given: "a governance model with a C4 architecture, no views of viewpoints, and AI configured"
tests: |
  apps/e2e/tests/studio/forge.spec.ts › Forge asks for the view structure and files the run into the Radical one
  packages/common/tests/forgeViews.test.ts › radical structure
  apps/mcp/src/forge.test.ts › files a run into the Radical structure the user chose
then: "the Description step listed the 20 viewpoints by folder; at the start Traceability is made in the folder Conceptual and is on screen, and System context, Containers, Components and Container dependencies in the folder Logical for the architecture already there; after the stage Requirement coverage and Requirement gaps appear in the folder Governance and Traceability is on screen again; no view of Specification or of a viewpoint that shows nothing (Fitness functions, Domain model) is made, no Arrange question is asked since no canvas shows the requirements, and the structure can no longer be changed"
when: "the user opens Radical Forge, leaves the Radical structure as it is preselected (unticking Specification under Customise), starts the run and generates requirements"
---
