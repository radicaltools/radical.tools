---
id: "a9f3a20d-4987-4478-9c5a-2ab9ec6e4b98"
type: "requirement"
label: "Semantic C4 candidate"
action: "Smart Layout shall include a C4-aware candidate that places persons above the systems they use, layers internal systems by dependency depth from the entry points and puts external systems in a column on the right."
ears_type: "ubiquitous"
rationale: "Architects expect actors on top and external systems at the edge; a candidate that knows C4 often wins on real diagrams. Evidence: packages/layout/src/radicalLayout.ts:1-16, packages/layout/src/radicalLayout.ts:296-468; packages/layout/src/smartLayout.ts:1169-1172; packages/layout/tests/radicalLayout.test.ts:315-351, packages/layout/tests/radicalLayout.test.ts:705-720"
---
