---
id: "92c8bf00-162a-4eac-91ad-a8b0cc9bbce2"
type: "requirement"
label: "Annealing refines best candidates"
action: "Smart Layout shall refine the two best-ranked candidates with simulated annealing in three phases: root elements, the children inside each container, and a final polish on the full rendered score."
ears_type: "ubiquitous"
rationale: "Annealing escapes local minima that the engines and greedy swaps get stuck in. Evidence: packages/layout/src/smartLayout.ts:768-935, packages/layout/src/smartLayout.ts:1244-1267; packages/layout/src/annealing.ts:537; packages/layout/tests/annealing.test.ts:72-117; manual#layout"
---
