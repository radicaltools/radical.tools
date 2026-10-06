---
id: "eab07f2c-b0ed-452a-8feb-8d3f1ece02d1"
type: "requirement"
label: "Show a slide's content"
action: "Studio shall show the slide's model copy (or its linked milestone for slides without one), apply its positions and collapse state, open its linked view and animate the camera to its captured viewport."
ears_type: "event-driven"
rationale: "Each slide must look the way it was composed, independent of the current model. Evidence: packages/ui/src/store/diagramStore.ts:3859-3981; packages/ui/tests/presentation.test.ts:139-218; apps/e2e/tests/studio/presentation.spec.ts:10-36; manual#presenting"
trigger: "a slide is shown during a presentation"
---
