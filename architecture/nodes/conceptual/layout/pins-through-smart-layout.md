---
id: "a37c201c-ebb6-4e35-b150-ec6acac01186"
type: "scenario"
label: "Pins through Smart Layout"
given: "a view with two elements pinned where the author dropped them, the rest piled up"
tests: |
  packages/layout/tests/tidy/craft.test.ts › pinned elements stay where they are
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › a frame holding a pinned element is not moved
  packages/ui/tests/calmDrag.test.ts › Pins in the store › Smart Layout over the whole view unpins it; round a selection the pinned elements stay, pinned
  apps/mcp/src/folderModel.test.ts › long Smart Layout runs › unpins the view it lays out whole; round a selection the pinned elements stay, pinned
then: "over the whole view every element is arranged and the pins are taken off; round a selection the pinned elements have not moved, nor the frames holding them (moving one would carry them along), the rest stands tidied round them, and the pins are still there"
when: "Smart Layout runs over the whole view, or tidies around a selection"
---
