---
id: "2f2472aa-3e93-41d6-a522-e17ebd4d5f47"
type: "requirement"
label: "Back and forward"
action: "Studio shall show the place of the previous or the next route of the history, passing over a place that is gone (an exploration closed since), name that place in the button's tooltip, and grey out ‹ at the first route and › at the last"
ears_type: "event-driven"
rationale: "One gesture back to where the user was, from anywhere, the Inspector included. Evidence: apps/studio/src/renderer/src/components/NavHistory.tsx (NavButtons), apps/studio/src/renderer/src/navHistory.ts"
trigger: "the user presses ‹ or › in the toolbar, Alt+← or Alt+→ (⌘[ or ⌘] on a Mac) outside a text field, a mouse's back or forward button in the desktop app, or the browser's own Back or Forward"
---
