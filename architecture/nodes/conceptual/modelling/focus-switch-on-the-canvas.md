---
id: "52dabd06-d30b-4ffd-acd8-f48da082b4df"
type: "requirement"
label: "Focus switch on the canvas"
action: "Studio shall leave every element and relation of a canvas as it is drawn when something on it is selected, with no dimming and no camera move (no framing, and no return to an earlier camera, for a click on an element or on the empty canvas); the Focus switch among the canvas controls at the canvas's bottom shall turn the selection focus on and off at once, show whether it is on, and be remembered in this browser, on by default, whatever other setting is changed meanwhile."
ears_type: "state-driven"
precondition: "Focus is off"
rationale: "The selection focus (Selection brings relations forward) helps to follow one element's relations, but it gets in the way while laying a view out, when every element should stay readable. The owner asked for a switch visible on the canvas rather than a setting in a menu. One switch covers the dimming and the camera framing: framing the neighbours of an element without showing which they are would only move the camera. In run 179 (round 177–184, 2026-10-23) a click with Focus off still flew the camera back out to an older one (F-0040), and changing Wizard on create in Settings turned Focus back on after a reload (F-0039). Evidence: packages/ui/src/studioSettings.ts (selectionFocus, updateStudioSettings), packages/ui/src/store/canvasFocus.ts (selectCanvasFocus), packages/ui/src/components/Canvas.tsx (frameSelection), packages/ui/src/components/CanvasControls.tsx, apps/e2e/tests/studio/selection-focus.spec.ts"
---
