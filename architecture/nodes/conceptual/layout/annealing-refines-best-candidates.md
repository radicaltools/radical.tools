---
id: "92c8bf00-162a-4eac-91ad-a8b0cc9bbce2"
type: "requirement"
label: "Annealing refines best candidates"
action: "Smart Layout shall anneal the root elements of the two best-ranked candidates, continue with the one that then scores better, anneal the children inside each container within their parent, finish with a polish of the root elements on the full rendered score, and hand the refined layout to the quality ranking together with every candidate, the relaxed best one and the layout on screen."
ears_type: "ubiquitous"
rationale: "Annealing escapes local minima that the engines and greedy swaps get stuck in. Evidence: packages/layout/src/smartLayout.ts:768-935, packages/layout/src/smartLayout.ts:1244-1267; packages/layout/src/annealing.ts:537; packages/layout/tests/annealing.test.ts:72-117; manual#layout"
---
