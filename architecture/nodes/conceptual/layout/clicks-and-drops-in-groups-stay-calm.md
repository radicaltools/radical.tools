---
id: "8c1d8a87-415a-4366-b181-4a7116e74a28"
type: "scenario"
label: "Clicks and drops in groups stay calm"
given: "a laid-out canvas with a system holding several groups; and a view that draws elements without the containers they are in"
tests: |
  packages/layout/tests/liveColaRest.test.ts › Live layout physics: a diagram that has a layout › keeps it through a ⌘/Ctrl-click: a push grab released without a move (item 214)
  packages/ui/tests/calmDrag.test.ts › A drag and the open containers it does not touch › keeps the groups beside the one dragged in below their system's header (item 218)
  packages/ui/tests/calmDrag.test.ts › Calm drag › leaves nothing overlapping when a child is dragged far out of its container, past the one below
  packages/ui/tests/calmDrag.test.ts › Calm drag › leaves nothing overlapping when the pushes run out
  packages/ui/tests/calmDrag.test.ts › leaves the frames round an element dragged a little inside its group as they were (F-0028, 20 px)
  packages/ui/tests/calmDrag.test.ts › leaves a container where it stands when its only child is dragged a little inside it (F-0028)
  packages/ui/tests/physicsStands.test.ts › moves only API Gateway when it is dragged 20 px right inside Access & Security
  apps/e2e/tests/studio/physics.spec.ts › a short drag inside a group leaves the frames round it, and everything else, where they are
  packages/ui/tests/calmDrag.test.ts › A drag on a view that does not draw the containers its elements are in (F-0048) › moves only the dropped element where it covers nothing
  packages/ui/tests/calmDrag.test.ts › A drag on a view that does not draw the containers its elements are in (F-0048) › pushes what the drop covers, across the containers the view does not draw
  packages/layout/tests/geometry.test.ts › placeUnplaced › lets a container the view does not draw grow without pushing its neighbours (F-0048)
then: "the click moves nothing and the physics does not start; after the drop the groups beside it stay below their system's header and the group's frame holds its child groups as drawn; after each drop nothing overlaps; on the view without the containers the drop moves only the dropped element, or pushes only what it covers, and a container it does not draw grows without pushing its neighbours"
when: "the user Cmd/Ctrl-clicks an element without moving it, drops an element inside one of the groups, drags a child far out of its container past the one below, and drops an element onto more elements than the pushes can clear; and, on the view without the containers, drops an element where it covers nothing and where it covers another"
---
