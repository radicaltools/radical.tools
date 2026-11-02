---
id: "c0664ba4-b284-4a63-a65b-d7d211c50600"
type: "requirement"
label: "Layout sees every drawn line"
action: "Smart Layout shall arrange and score a view with every relation the canvas draws on it: a relation of an element the view does not list on its nearest listed ancestor, the relations rolled up onto one pair as one line labelled with each of their names on a line of its own, and with a technology only when they all share it, and every relation between two shown elements as a line of its own."
ears_type: "ubiquitous"
rationale: "Layouts left out every relation of an element a view does not list and merged the relations between one pair into one: on the \"Shared packages\" view of radical.tools' own model they saw 25 of the 45 lines drawn, and packed the applications into one corner with no idea of the lines between them. A rolled-up line was sized as one run-on name with the first relation's technology (round 185–192, 2026-10-26, F-0078). Evidence: packages/layout/src/edgeLabels.ts (relationLabelLines), packages/layout/src/viewInput.ts (filterForView), packages/layout/src/geometry.ts (projectToVisibleGraph), packages/ui/src/store/diagramStore.ts (deriveRFEdges), packages/layout/tests/drawnLines.test.ts"
---
