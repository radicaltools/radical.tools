---
id: "df771df3-4ad6-45c7-97ac-f4445e2a110d"
type: "requirement"
label: "Start a presentation"
action: "Studio shall save a name being typed first (a slide's name, a table cell, a Warnier step), close what is open over the canvas (the Discuss menu, the relation type asked for, the Explore menu) without adding anything, hide the toolbar and side panels, show a navigation bar with the slide name and position, and show the current slide, the slide keys moving the slides."
ears_type: "event-driven"
rationale: "Presenting needs the canvas and nothing else. F5 and Cmd/Ctrl+P in a slide's name field were the field's (F-0086), F5 while a name was typed in the table or a Warnier step presented without saving it (F-0109), and a menu open over the canvas stayed over the slides and took their keys (F-0087) (round 193–200, 2026-10-26). Evidence: packages/ui/src/store/diagramStore.ts:3814-3833; apps/studio/src/renderer/src/App.tsx:98-114; apps/studio/src/renderer/src/components/PresentationBar.tsx:224-270; apps/studio/src/renderer/src/components/Toolbar.tsx:564-572; manual#presenting; packages/ui/src/components/keysHere.ts (keepKeysHere)"
trigger: "the user clicks Present or presses F5 (also in a name field) with at least one slide in the active presentation"
---
