---
id: "f600ab7a-c7a2-4b0c-87a7-d6513998ae23"
type: "requirement"
label: "Zoom keys"
action: "zoom the canvas in or out, as the canvas's Zoom in (⌘+) and Zoom out (⌘−) buttons say"
ears_type: "event-driven"
rationale: "The shortcuts the buttons' tooltips promise must work. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx (keys), packages/ui/src/components/CanvasControls.tsx, apps/e2e/tests/studio/editing.spec.ts"
trigger: "the user presses ⌘/Ctrl+= or ⌘/Ctrl+− on the canvas"
---
