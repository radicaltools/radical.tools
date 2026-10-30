---
id: "d56403a7-fbc5-47c1-a8dd-2034398241ca"
type: "scenario"
label: "Containers dropped into a system fill a grid"
given: "a canvas with an empty software system, a system holding a container with room to its right, and the layout engine with a container holding elements"
metrics: |
  test(packages/layout/tests/geometry.test.ts › settleMovedNodes › centres an element moved alone into an empty parent across it, below its header) passed
  test(packages/layout/tests/geometry.test.ts › settleMovedNodes › puts one moved among the parent's children in the first free cell of their grid) passed
  test(apps/e2e/tests/studio/nesting.spec.ts › containers dropped into a system fill a grid, the first centred) passed
  test(packages/ui/tests/paletteDrop.test.ts › a palette drop into a container › stays under the pointer where there is room for it) passed
  test(packages/ui/tests/paletteDrop.test.ts › a palette drop into a container › goes to the next cell of the grid over another element, the header or the edge) passed
then: "the first container stands centred across the system below its header; the second stands in the next cell, beside the first in the same row; one dropped in free room stays with its middle under the pointer and the container already there does not move; one dropped over the container, the header or the edge goes to the next cell, beside the container in its row; the engine centres the lone element and puts the other in the first free cell of the children's grid"
when: "the user drops a container from the palette onto the system, then a second one at its edge; drops one in the free room of the other system, and one over its container, its header and its edge; and the engine places an element moved alone into an empty parent, and one beside children"
---
