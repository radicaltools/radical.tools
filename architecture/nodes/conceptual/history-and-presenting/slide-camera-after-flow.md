---
id: "6f737a56-8157-4440-aff1-f0dcf60a210a"
type: "scenario"
label: "Slide camera after flow"
given: "a sample presentation playing a canvas slide that is followed by a Flow view slide"
metrics: "test(apps/e2e/tests/studio/physics.spec.ts › a canvas slide after a slide without a canvas has its own camera) passed"
then: "the canvas slide shows again with its own captured camera"
when: "the presenter goes to the flow slide and back with the arrow keys"
---
