---
id: "8276f09e-3606-4d74-ae94-0dc674ed6d4c"
type: "requirement"
label: "Search result jumps there"
action: "Studio shall, when the active view does not show the element, switch to one that does: a diagram (structure) view first, then a table, wiki, hierarchy or Warnier view, then a matrix or flow view, the smallest of the kind first; expand its collapsed ancestors, select it and, on a canvas, zoom onto it; open its page on a wiki and drill a hierarchy to a level that draws it; on a table, wiki, matrix or Warnier view that shows it, the selection opens its properties card there; and keep the highlighted result in sight while the arrow keys move it"
ears_type: "event-driven"
rationale: "The result is only useful if the user lands on it, even when it is hidden in another view or a folded system. A pick took the smallest view whatever its kind, often a matrix or a flow where the element is a row or a participant; the maintainer decided on 2026-10-21 (D12, exploratory runs 45 to 64) that a diagram comes first. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx (viewForPick); packages/ui/src/components/Canvas.tsx; apps/studio/tests/quickSearchPick.test.ts; manual#workspace"
trigger: "the user picks an element result in Quick Search"
---
