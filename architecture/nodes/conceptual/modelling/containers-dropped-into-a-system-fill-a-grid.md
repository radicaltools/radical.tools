---
id: "d56403a7-fbc5-47c1-a8dd-2034398241ca"
type: "scenario"
label: "Containers dropped into a system fill a grid"
given: "a canvas with an empty software system, and the layout engine with a container holding elements"
tests: |
  packages/layout/tests/geometry.test.ts › settleMovedNodes › centres an element moved alone into an empty parent across it, below its header
  packages/layout/tests/geometry.test.ts › settleMovedNodes › puts one moved among the parent's children in the first free cell of their grid
  apps/e2e/tests/studio/nesting.spec.ts › containers dropped into a system fill a grid, the first centred
then: "the first container stands centred across the system below its header; the second stands in the next cell, beside the first in the same row, whatever the drop point; the engine centres the lone element and puts the other in the first free cell of the children's grid"
when: "the user drops a container from the palette onto the system, then a second one anywhere on it; and the engine places an element moved alone into an empty parent, and one beside children"
---
