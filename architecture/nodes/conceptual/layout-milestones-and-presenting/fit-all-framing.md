---
id: "d721ff03-ec31-4c0f-9ad7-7466e8137023"
type: "requirement"
label: "Fit All framing"
action: "Studio shall move the camera with an animation so that all visible elements fit the viewport."
ears_type: "event-driven"
rationale: "Getting the whole diagram back into view in one click is basic navigation. Evidence: packages/ui/src/store/diagramStore.ts:4326-4337; apps/studio/src/renderer/src/components/Toolbar.tsx:672-678; packages/ui/tests/autoFit.test.ts:150; manual#layout"
trigger: "the user clicks Fit All"
---
