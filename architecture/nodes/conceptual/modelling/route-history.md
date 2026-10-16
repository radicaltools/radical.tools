---
id: "4a844df1-463f-4ecd-9bb6-34b04a58b195"
type: "requirement"
label: "Route history"
action: "Studio shall add its route to the window's history, one entry for the changes of one step (a link that switches perspective, view and selection at once), none when the route is the one already there, and none when the change came from going back or forward or from applying a link"
ears_type: "event-driven"
rationale: "Going back is the history of routes, kept by the browser (and the desktop app's window), so Studio's buttons, the browser's own and the keys all walk the same list. Evidence: apps/studio/src/renderer/src/route.ts (writeUrl push or replace, the 150 ms coalescing), apps/studio/src/renderer/src/navHistory.ts"
trigger: "the place on screen changes: another document, perspective, view, Inspector tab, selected element, wiki page, milestone or slide"
---
