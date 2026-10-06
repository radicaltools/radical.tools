---
id: "a8e61526-07f9-4b52-8fc3-ccc72a0af7db"
type: "requirement"
label: "Per-view positions and camera"
action: "Studio shall save the element positions and camera of the outgoing view and restore those saved for the incoming view."
ears_type: "complex"
precondition: "Studio is in the Designer perspective"
rationale: "Each view keeps its own arrangement, so arranging one diagram never disturbs another. Evidence: packages/ui/src/store/diagramStore.ts:2225-2305; packages/ui/tests/views.test.ts:113-178; manual#views"
trigger: "the user switches to another view"
---
