---
id: "269a9533-58fa-4f09-bbb3-b6180a9490e6"
type: "requirement"
label: "Large views open fast"
action: "Studio shall draw the view within 2 seconds, placing its relation labels only while the zoom shows them or an export draws them, placing 1400 labels among 1600 elements in well under a second, and placing them again only when an element moved, resized, appeared or changed parent, a route changed, or a label changed size."
ears_type: "event-driven"
rationale: "Opening the Structure view of radical.tools' own model took 6.3 s (2026-10-14): the edge label placement sampled 889,000 points of the paths as objects and checked each candidate spot with a set of them, and React Flow's state changes while a view opens made it run three times on unchanged input. Samples now sit flat in a 50 px grid, the candidate checks keep stamps instead of sets, edgeGeometry reuses the last placement when nothing it was placed against changed (0.9 s), and the labels are not placed while the zoom hides them, as it does when a whole large model fits on screen (0.3 s). Evidence: packages/layout/src/edgeLabels.ts (LineSamples, placeEdgeLabels), packages/ui/src/components/edges/edgeGeometry.ts (labelCache, sameParents, edgeLabelsShownAt), packages/ui/src/components/edges/RelationEdge.tsx, apps/studio/src/renderer/src/hooks/useExport.ts, apps/e2e/tests/studio/bench.spec.ts (the benchmark, run with BENCH_MODEL)"
trigger: "the user opens a view of a large model, such as the whole of radical.tools' own model (about 820 elements and 1400 labelled relations on one canvas)"
---
