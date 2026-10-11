---
id: "96d5274f-90ca-4fe6-89c8-87dbb9f9ae8f"
type: "scenario"
label: "Diagram drawn on slow machine"
gherkin: "# Covered by: apps/e2e/tests/studio/metamodel-diagram.spec.ts › the diagram stays drawn on a slow machine"
given: "the CPU is throttled six times"
then: "the layout finishes and all 96 edges and the Requirement box are drawn"
when: "the user opens the Diagram tab of the governance metamodel"
---
