---
id: "99d5dc89-e2bf-43ed-8208-64714fc6af43"
type: "requirement"
label: "History list"
action: "Studio shall list the places of this window's history, the newest first, each with its perspective, view or tab, selected element and how long ago, mark the current one, dim those ahead of it, and go to the place picked"
ears_type: "event-driven"
rationale: "Several steps back at once, and a look at where the user has been. Evidence: apps/studio/src/renderer/src/components/NavHistory.tsx (HistoryMenu), apps/studio/src/renderer/src/navHistory.ts"
trigger: "the user opens History in the toolbar"
---
