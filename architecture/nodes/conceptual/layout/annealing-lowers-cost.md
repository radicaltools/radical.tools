---
id: "e45e44ae-31ca-42ff-b05b-05630fb2f239"
type: "scenario"
label: "Annealing lowers cost"
given: "a laid-out grid whose relations cross"
tests: |
  packages/layout/tests/annealing.test.ts › anneal
  packages/layout/tests/smartLayout.test.ts › runSmartLayoutCore (end-to-end ensemble + SA refinement) › never hands back a result worse than the input, and improves a scattered diagram
then: "annealing lowers the energy without making siblings overlap and gives the same result for the same seed, and Smart Layout never returns a result worse than its input"
when: "simulated annealing refines it, and Smart Layout runs its ensemble with annealing on a scattered diagram"
---
