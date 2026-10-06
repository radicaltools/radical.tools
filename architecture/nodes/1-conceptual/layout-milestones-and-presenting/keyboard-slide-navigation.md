---
id: "1398e996-e863-4aee-9f35-3c84059007be"
type: "requirement"
label: "Keyboard slide navigation"
action: "Studio shall go to the next slide on Right arrow, Down arrow or Space, to the previous slide on Left arrow or Up arrow, and end the presentation on Escape."
ears_type: "state-driven"
precondition: "a presentation is running"
rationale: "Presenters drive slides from the keyboard or a clicker. Evidence: apps/studio/src/renderer/src/components/PresentationBar.tsx:224-242; packages/ui/src/store/diagramStore.ts:3859-3863; apps/e2e/tests/studio/presentation.spec.ts:10-36; manual#presenting"
---
