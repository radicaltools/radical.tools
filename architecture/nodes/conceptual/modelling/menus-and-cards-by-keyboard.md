---
id: "5690ed24-c7bf-4068-9ec5-ba9d1b19c537"
type: "requirement"
label: "Menus and cards by keyboard"
action: "Studio shall keep the Radical menu and the menus of the selection's actions (Move to…, Wrap into…, Align…, Change source…, Change destination…) inside the window, scrolling when long, answering ↑, ↓, Home, End and Esc and closing when Tab leaves them; open view, milestone, sequence and type cards with Enter or Space; clear the canvas selection on Esc; leave the browser its zoom on ⌘+ off a canvas; and leave the keyboard on a table row whose name was written"
ears_type: "ubiquitous"
rationale: "Exploratory runs 45 to 64 (2026-10-21, items 168, 215 and 217) found menus running off the window, cards that only a mouse opened, ⌘+ off a canvas breaking the canvas, and the focus lost after a name was written in the table. Evidence: packages/ui/src/hooks/menuKeys.ts, packages/ui/src/components/SelectionActions.tsx (ActionMenu), apps/studio/src/renderer/src/components/Toolbar.tsx (Radical menu), packages/ui/src/components/RightPanel.tsx (cards), packages/ui/src/components/TableView.tsx"
---
