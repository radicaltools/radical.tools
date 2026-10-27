---
id: "9b087a72-9ba9-48a6-834e-319cbe40f887"
type: "requirement"
label: "Recent places in search"
action: "Studio shall list the places visited last (views and elements of the navigation history, the one shown left out), newest first, and go back to the one picked"
ears_type: "event-driven"
rationale: "Most searches are for something seen a minute ago. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx; apps/studio/src/renderer/src/navHistory.ts"
trigger: "the user opens Quick Search with nothing typed"
---
