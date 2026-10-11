---
id: "df771df3-4ad6-45c7-97ac-f4445e2a110d"
type: "requirement"
label: "Start a presentation"
action: "Studio shall hide the toolbar and side panels, show a navigation bar with the slide name and position, and show the current slide."
ears_type: "event-driven"
rationale: "Presenting needs the canvas and nothing else. Evidence: packages/ui/src/store/diagramStore.ts:3814-3833; apps/studio/src/renderer/src/App.tsx:98-114; apps/studio/src/renderer/src/components/PresentationBar.tsx:224-270; apps/studio/src/renderer/src/components/Toolbar.tsx:564-572; manual#presenting"
trigger: "the user clicks Present or presses F5 with at least one slide in the active presentation"
---
