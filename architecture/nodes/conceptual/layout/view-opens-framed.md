---
id: "40dcd7a8-eba1-43a8-a4d3-3a953f3ac92d"
type: "scenario"
label: "View opens framed"
given: "a Containers view whose saved camera points away from its elements, with Smart fit on"
tests: |
  apps/e2e/tests/studio/physics.spec.ts › opening a view with Smart fit frames it at once, without a camera flight
  apps/e2e/tests/studio/physics.spec.ts › Viewer fits a view with a saved camera when it opens
then: "the view's elements are framed and centred on screen from the first frames, without a camera flight"
when: "the user opens that view from another view, in Designer or in Viewer"
---
