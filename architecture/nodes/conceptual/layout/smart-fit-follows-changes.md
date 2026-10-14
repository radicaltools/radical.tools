---
id: "137f776c-7acb-476a-9e3a-ab06151cac4b"
type: "requirement"
label: "Smart Fit follows changes"
action: "Studio shall re-fit the camera to the visible elements every 300 ms, except while a presentation is running."
ears_type: "state-driven"
precondition: "Smart Fit is switched on in the Radical menu"
rationale: "Keeping the camera fitted is useful while importing or laying out, and must not fight a slide's own framing. Evidence: packages/ui/src/store/diagramStore.ts:4344-4365; apps/studio/src/renderer/src/components/Toolbar.tsx:395; packages/ui/tests/autoFit.test.ts:41-148; manual#layout"
---
