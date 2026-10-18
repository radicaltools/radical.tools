---
id: "f33ce51a-c830-4765-b8c6-2f18ec8d9da5"
type: "requirement"
label: "Search on every view"
action: "Studio shall show the Quick Search bar, with its Forge button, in the toolbar"
ears_type: "state-driven"
precondition: "a view of any type is shown (a canvas, a table, a wiki, a matrix, a hierarchy, a flow or a Warnier view), outside the Inspector and a running presentation"
rationale: "A model opens on All elements, a table: with the bar on canvases only, a new user met no search box and no Forge button. Evidence: apps/studio/src/renderer/src/App.tsx (QuickSearch on every view), apps/studio/src/renderer/src/components/QuickSearch.tsx"
---
