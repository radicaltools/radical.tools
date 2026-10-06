---
id: "0e124100-20d0-487c-b89f-4c30d7f94fbe"
type: "requirement"
label: "Sibling swaps reduce crossings"
action: "Smart Layout shall try swapping the positions of sibling elements in every candidate before scoring it and keep a swap only when it lowers the crossing and overdraw cost."
ears_type: "ubiquitous"
rationale: "Swapping same-level boxes removes crossings that the engines leave behind, so all candidates compete at their best. Evidence: packages/layout/src/crossingOpt.ts:1-30, packages/layout/src/crossingOpt.ts:343; packages/layout/src/smartLayout.ts:1004-1030; packages/layout/tests/layoutPipeline.test.ts:102-111; README (crossing minimisation)"
---
