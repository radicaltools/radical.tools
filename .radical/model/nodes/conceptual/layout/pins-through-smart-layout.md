---
id: "a37c201c-ebb6-4e35-b150-ec6acac01186"
type: "scenario"
label: "Pins through Smart Layout"
given: "a view with two elements pinned where the author dropped them, the rest piled up"
metrics: |
  test(packages/layout/tests/tidy/craft.test.ts › pinned elements stay where they are) passed
  test(packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › a frame holding a pinned element is not moved) passed
  test(packages/ui/tests/calmDrag.test.ts › Pins in the store › Smart Layout over the whole view unpins it; round a selection the pinned elements stay, pinned) passed
  test(apps/mcp/src/folderModel.test.ts › long Smart Layout runs › unpins the view it lays out whole; round a selection the pinned elements stay, pinned) passed
  test(packages/ui/tests/calmDrag.test.ts › Pins in the store › a Smart Layout that has nothing left to tidy but unpins is an undo step of its own (F-0073)) passed
then: "over the whole view every element is arranged and the pins are taken off; round a selection the pinned elements have not moved, nor the frames holding them (moving one would carry them along), the rest stands tidied round them, and the pins are still there; a run over a view with nothing left to tidy that only unpins is one undo step, and Undo pins the elements again and moves nothing"
when: "Smart Layout runs over the whole view, or tidies around a selection"
---
