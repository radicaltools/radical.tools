---
id: "3b2489bf-27cc-42d7-ba50-c8560042cd91"
type: "requirement"
label: "Open hit in chosen view"
action: "Studio shall open the hit in that view, or in All elements for the All chip, expand its collapsed ancestors and select it; each hit shows up to three views that show it with a count of the rest, and an element no view shows is marked model only."
ears_type: "event-driven"
rationale: "An element often appears in several views; the user picks the context to land in. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx (quick-search-view-chip, pickResult with viewOverride)."
trigger: "the user clicks a view chip of an element or relation in the Quick Search results"
---
