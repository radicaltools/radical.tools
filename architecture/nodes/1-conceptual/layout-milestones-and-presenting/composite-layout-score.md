---
id: "027d5a33-672b-4c70-8cfe-23841dfc0f1c"
type: "requirement"
label: "Composite layout score"
action: "Smart Layout shall rank candidates by a composite cost in which rendered edge crossings weigh most, followed by sibling overlap, edges drawn through unrelated elements, edge length, leaf placement, aspect ratio, compactness and symmetry."
ears_type: "ubiquitous"
rationale: "One cost that matches what people perceive as messy is what lets the ensemble pick the cleanest result rather than just the one with fewest crossings. Evidence: packages/layout/src/smartLayout.ts:61-98, packages/layout/src/smartLayout.ts:334-514, packages/layout/src/smartLayout.ts:1227-1240; packages/layout/src/scoreWeights.ts:1-41; packages/layout/tests/smartLayout.test.ts:22-80; manual#layout"
---
