---
id: "a26342db-c9e3-4680-ac5e-fc4fec91d5e8"
type: "scenario"
label: "Wireframe from linked context"
gherkin: "# Covered by: apps/studio/tests/mockupWireframe.test.ts › buildWireframePrompt › includes the linked model context"
given: "a Checkout mockup that illustrates a requirement and a scenario and navigates to a Confirmation screen via \"Pay\""
then: "the prompt sent to the provider contains the requirement, the scenario steps and \"Confirmation (via Pay)\", and the returned SVG is stored on the mockup"
when: "the user presses ✨ Generate wireframe"
---
