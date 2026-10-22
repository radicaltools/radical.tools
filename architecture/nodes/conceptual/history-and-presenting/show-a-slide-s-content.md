---
id: "eab07f2c-b0ed-452a-8feb-8d3f1ece02d1"
type: "requirement"
label: "Show a slide's content"
action: "Studio shall show the slide's model copy (or its linked milestone for slides without one), apply its positions and its containers folded or open as they were captured, whatever the view does since, draw the elements its view gained since it was captured where the view places them, beside the captured ones where that lies on them, open its linked view at that view's own places (All elements' places for one never laid out, All elements for a view since deleted), its Hierarchy drill focus (the top for a slide without one) and its Wiki page and page mode, and animate the camera to its captured viewport, or, for a slide without one, zoom onto its focus elements once the canvas is ready, or fit the view; keep the slide shown current when the slides are reordered from outside; and show a slide whose card is clicked anywhere but on Capture."
ears_type: "event-driven"
rationale: "Each slide must look the way it was composed, independent of the current model. Evidence: packages/ui/src/store/diagramStore.ts:3859-3981; packages/ui/tests/presentation.test.ts:139-218; apps/e2e/tests/studio/presentation.spec.ts:10-36; manual#presenting"
trigger: "a slide is shown during a presentation"
---
