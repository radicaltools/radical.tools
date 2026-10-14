---
id: "027d5a33-672b-4c70-8cfe-23841dfc0f1c"
type: "requirement"
label: "Composite layout score"
action: "Smart Layout shall rank candidates by one composite cost of the layout as it would be rendered, in which each edge crossing weighs most, plus element overlap, edges drawn through unrelated elements, edges looping back at an end, edge length (mean, longest and outliers), leaves near the centre, departure from a √2 aspect ratio, a sparse bounding box, asymmetry, and labelled relations whose ends leave no room for the label."
ears_type: "ubiquitous"
rationale: "One cost that matches what people perceive as messy is what lets the ensemble pick the cleanest result rather than just the one with fewest crossings. Evidence: packages/layout/src/smartLayout.ts:61-98, packages/layout/src/smartLayout.ts:334-514, packages/layout/src/smartLayout.ts:1227-1240; packages/layout/src/scoreWeights.ts:1-41; packages/layout/tests/smartLayout.test.ts:22-80; manual#layout"
---
