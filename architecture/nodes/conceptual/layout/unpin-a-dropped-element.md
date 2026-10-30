---
id: "903e53f2-3e72-473d-9f86-c99ece7cf21e"
type: "scenario"
label: "Unpin a dropped element"
given: "an element dropped onto another, so both are pinned; and a pinned container, selected"
metrics: |
  test(packages/ui/tests/calmDrag.test.ts › Pins in the store › pins what a drag drops, unpins as one undo step, forgets deleted elements) passed
  test(apps/e2e/tests/studio/physics.spec.ts › a click on a pinned container's pin unpins it, and leaves it expanded (F-0075)) passed
then: "only the other stays pinned, and one Undo pins it again; the container is unpinned and stays expanded"
when: "the dropped element is unpinned; and the container's pin is clicked"
---
