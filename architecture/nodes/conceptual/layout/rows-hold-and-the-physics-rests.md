---
id: "94c0706d-2c4a-4db8-9201-2ed042537249"
type: "scenario"
label: "Rows hold and the physics rests"
given: "canvases with rows of containers, rows of elements in a container, and the sample model"
tests: "packages/ui/tests/physicsStands.test.ts"
then: "every row stays on its line as drawn and a reload moves nothing; no seed of an expand is left in the physics; the run on the sample comes to rest by itself"
when: "the physics runs after a drop, a fold, a delete or a hide, the layout is built again, a container is unfolded on a view that does not draw its children, and a component is added on the sample"
---
