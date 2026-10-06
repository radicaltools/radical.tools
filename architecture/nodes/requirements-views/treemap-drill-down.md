---
id: "72e5346a-549f-462e-9fac-0014943d0a5b"
type: "requirement"
label: "Treemap drill-down"
action: "The hierarchy view shall focus that subtree, show the path in the breadcrumb and save the focus with the view."
ears_type: "event-driven"
rationale: "Portfolio overviews need to zoom from the whole landscape into one branch and come back to the same place. Evidence: apps/studio/src/renderer/src/components/TreemapView.tsx:273-290, 458-471, 476-494; packages/ui/src/store/diagramStore.ts:2370-2377; manual#view-hierarchy"
trigger: "the user double-clicks a rectangle that has children in a Hierarchy view"
---
