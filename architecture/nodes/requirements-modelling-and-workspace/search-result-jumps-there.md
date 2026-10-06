---
id: "8276f09e-3606-4d74-ae94-0dc674ed6d4c"
type: "requirement"
label: "Search result jumps there"
action: "Studio shall switch to a view that contains the element when the active one does not, expand its collapsed ancestors, select it and zoom onto it."
ears_type: "event-driven"
rationale: "The result is only useful if the user lands on it, even when it is hidden in another view or a folded system. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx:303-318,357-435; packages/ui/src/components/Canvas.tsx:469-485; manual#workspace"
trigger: "the user picks an element result in Quick Search"
---
