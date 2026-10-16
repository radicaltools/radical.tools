---
id: "99d5dc89-e2bf-43ed-8208-64714fc6af43"
type: "requirement"
label: "History list"
action: "Studio shall list the places of this window's history, at most the last 50 as browsers keep them, the newest first, each with its perspective, view or tab, selected element and how long ago, mark the current one, dim those ahead of it, go to the place picked, and keep the list through a reload of the window and no longer than the window"
ears_type: "event-driven"
rationale: "Several steps back at once, and a look at where the user has been. The list is in the window's sessionStorage, never in the model or its files. Evidence: apps/studio/src/renderer/src/components/NavHistory.tsx, apps/studio/src/renderer/src/navHistory.ts (MAX_ENTRIES, saveNav, restoreNav)"
trigger: "the user opens History in the toolbar"
---
