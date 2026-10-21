---
id: "8c1d8a87-415a-4366-b181-4a7116e74a28"
type: "scenario"
label: "Clicks and drops in groups stay calm"
given: "a laid-out canvas with a system holding several groups"
tests: |
  packages/layout/tests/liveColaRest.test.ts › Live layout physics: a diagram that has a layout › keeps it through a ⌘/Ctrl-click: a push grab released without a move (item 214)
  packages/ui/tests/calmDrag.test.ts › A drag and the open containers it does not touch › keeps the groups beside the one dragged in below their system's header (item 218)
then: "the click moves nothing and the physics does not start; after the drop the groups beside it stay below their system's header and the group's frame holds its child groups as drawn"
when: "the user Cmd/Ctrl-clicks an element without moving it, and drops an element inside one of the groups"
---
