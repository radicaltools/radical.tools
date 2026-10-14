---
id: "d8f08835-4aab-4160-afb9-803595fd0460"
type: "requirement"
label: "Edge bar re-routes relation"
action: "Studio shall show an edge action bar with Change source…, Change destination… (listing only endpoints the metamodel allows), Hide from view when a named view is active, and Delete."
ears_type: "event-driven"
rationale: "Re-routing a relation keeps its label and properties instead of forcing delete-and-redraw. Evidence: apps/studio/src/renderer/src/components/EdgeActionBar.tsx:72-121,133-240; manual#relations"
trigger: "the user selects a single relation in the Designer perspective"
---
