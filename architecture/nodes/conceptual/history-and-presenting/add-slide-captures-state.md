---
id: "280d506b-cf21-48a3-8652-9e5dab6b752f"
type: "requirement"
label: "Add slide captures state"
action: "Studio shall append a slide to the active presentation that records the active view, the camera, every element's position and collapse state, the shown milestone and a copy of the model."
ears_type: "event-driven"
rationale: "A slide must replay exactly what was on screen when it was made, even after the model changes. Evidence: packages/ui/src/store/diagramStore.ts:3758-3780, packages/ui/src/store/diagramStore.ts:155-162; apps/studio/src/renderer/src/components/PresentationBar.tsx:384-389; packages/ui/tests/presentation.test.ts:49-75; manual#presenting"
trigger: "the user clicks Add slide in the Presenter perspective"
---
