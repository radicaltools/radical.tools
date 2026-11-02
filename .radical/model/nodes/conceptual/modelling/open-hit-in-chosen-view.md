---
id: "3b2489bf-27cc-42d7-ba50-c8560042cd91"
type: "requirement"
label: "Open hit in chosen view"
action: "Studio shall list where to open it, in place of the results: the view a pick opens first, then every other view that shows it (a diagram before a table or wiki, before a matrix or flow, the smaller first), each with its type, folder and number of elements, then All elements; Enter opens it there, expands its collapsed ancestors and selects it, and the left arrow or Escape goes back to the results. A hit shows only how many views show it, or model only."
ears_type: "event-driven"
rationale: "An element often appears in several views; the user picks the context to land in. The views used to be chips on every hit, which cut each other and the names short in a long list (product owner, 2026-10-27: show the list first, ask where to open it in a next step). Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx (openIn, placesFor)."
trigger: "the user presses the right arrow on an element or relation hit in Quick Search, or clicks the count of views at its right"
---
