---
id: "aac21b83-a35d-48d9-a69e-839789bf09df"
type: "requirement"
label: "Re-capture a slide"
action: "Studio shall replace that slide's camera, view, element positions and collapse state, hierarchy drill level or wiki page, and model copy with what the screen shows now; a slide that shows no milestone, captured while one is shown, is linked to it and keeps no copy."
ears_type: "event-driven"
rationale: "A deck is kept up to date slide by slide instead of rebuilt. Capture on a milestone kept a hidden copy of it, so the slide went on showing it after the milestone was deleted (round 170–175, 2026-10-22, F-0016). Evidence: apps/studio/src/renderer/src/components/PresentationBar.tsx (Capture canvas state), packages/ui/src/store/diagramStore.ts (captureSlideViewport)."
trigger: "the user presses Capture on a slide in the Presenter dock"
---
