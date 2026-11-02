---
id: "5be31b5f-8f5b-4bce-ab35-f1de779a724a"
type: "requirement"
label: "Canvas controls on the canvas"
action: "Studio and the Hub shall show Fit All, Zoom out, Zoom in and Smart Layout (with its report, opening upwards) as one bar centred at the bottom of the canvas, the selection bar standing at its top, and nowhere in the toolbar; the other view kinds show none of them."
ears_type: "state-driven"
precondition: "a canvas view is shown and no presentation plays"
rationale: "They act on the canvas only, so they belong on it rather than in a toolbar every view shares. Evidence: packages/ui/src/components/CanvasControls.tsx, packages/ui/src/components/Canvas.tsx (Canvas), packages/ui/src/index.css (.canvas-controls), apps/studio/src/renderer/src/components/Toolbar.tsx, apps/hub/src/HubApp.tsx, apps/e2e/tests/studio/editing.spec.ts"
---
