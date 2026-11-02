---
id: "b683130f-b664-43ee-893a-c886902059e3"
type: "requirement"
label: "Spread relation ends"
action: "The canvas shall attach each relation to the side of each end element that faces the other end, preferring the top and bottom sides on near-diagonal offsets, and spread the relations that meet one side of an element evenly along that side, ordered by the position of their other ends."
ears_type: "ubiquitous"
rationale: "Without ports every relation met the centre of a side, so several relations entering one element from the same side merged into one trunk. Evidence: packages/layout/src/portAllocator.ts (pickSides, allocatePorts), packages/ui/src/components/edges/edgeGeometry.ts"
---
