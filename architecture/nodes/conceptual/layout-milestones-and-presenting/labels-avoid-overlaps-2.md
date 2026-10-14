---
id: "f36ce8d2-42f3-4637-959d-43c6313d5af7"
type: "requirement"
label: "Labels avoid overlaps"
action: "The canvas shall place every relation label at the middle of its path when that spot is free, and otherwise at the spot along or beside the path that covers the fewest element names, elements, other labels and relation lines, keeping labels off the ends of the path."
ears_type: "state-driven"
precondition: "a canvas has come to rest"
rationale: "Each edge used to centre its label on its own path, so labels of parallel or crossing relations landed on each other and labels of short relations covered the elements they join. placeEdgeLabels places all labels of a canvas together, tries eleven spots along the path and two beside each, and weighs covering an element's name double. While the live layout moves elements, labels sit at the middle of their path and are placed again at rest. Evidence: packages/layout/src/edgeLabels.ts (placeEdgeLabels), packages/ui/src/components/edges/edgeGeometry.ts, packages/layout/tests/edgeLabels.test.ts, apps/e2e/tests/studio/edge-labels.spec.ts"
---
