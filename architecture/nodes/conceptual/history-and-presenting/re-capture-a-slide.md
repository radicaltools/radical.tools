---
id: "aac21b83-a35d-48d9-a69e-839789bf09df"
type: "requirement"
label: "Re-capture a slide"
action: "Studio shall replace that slide's camera, view, element positions and collapse state, hierarchy drill level or wiki page, and model copy with what the screen shows now."
ears_type: "event-driven"
rationale: "A deck is kept up to date slide by slide instead of rebuilt. Evidence: apps/studio/src/renderer/src/components/PresentationBar.tsx (Capture canvas state), packages/ui/src/store/diagramStore.ts (captureSlideViewport)."
trigger: "the user presses Capture on a slide in the Presenter dock"
---
