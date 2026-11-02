---
id: "280d506b-cf21-48a3-8652-9e5dab6b752f"
type: "requirement"
label: "Add slide captures state"
action: "Studio shall append a slide to the active presentation that records the active view, the camera, the position and collapse state of every element the view draws (every element on All elements), and the milestone shown, to which the slide is linked with no copy of it, or else a copy of the model."
ears_type: "event-driven"
rationale: "A slide must replay exactly what was on screen when it was made, even after the model changes. It recorded the place of every element of the model, those the view did not draw included, and put them back over the view when shown: elements a view gained later were drawn on the captured ones (round 170–175, 2026-10-22, F-0015). Evidence: packages/ui/src/store/diagramStore.ts (captureCanvasState, addPresentationSlide); apps/studio/src/renderer/src/components/PresentationBar.tsx; packages/ui/tests/presentation.test.ts, packages/ui/tests/presenterSlides.test.ts; manual#presenting"
trigger: "the user clicks Add slide in the Presenter perspective"
---
