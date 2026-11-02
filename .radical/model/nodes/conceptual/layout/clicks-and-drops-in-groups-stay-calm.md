---
id: "8c1d8a87-415a-4366-b181-4a7116e74a28"
type: "scenario"
label: "Clicks and drops in groups stay calm"
given: "a laid-out canvas with a system holding several groups; and a view that draws elements without the containers they are in"
then: "the click moves nothing and the physics does not start; after the drop the groups beside it stay below their system's header and the group's frame holds its child groups as drawn; after each drop nothing overlaps; on the view without the containers the drop moves only the dropped element, or pushes only what it covers, and a container it does not draw grows without pushing its neighbours"
when: "the user Cmd/Ctrl-clicks an element without moving it, drops an element inside one of the groups, drags a child far out of its container past the one below, and drops an element onto more elements than the pushes can clear; and, on the view without the containers, drops an element where it covers nothing and where it covers another"
---
