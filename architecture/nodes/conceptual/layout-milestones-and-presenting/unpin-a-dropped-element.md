---
id: "903e53f2-3e72-473d-9f86-c99ece7cf21e"
type: "scenario"
label: "Unpin a dropped element"
given: "an element dropped onto another, so both are pinned"
tests: "packages/ui/tests/calmDrag.test.ts › Pins in the store › pins what a drag drops, unpins as one undo step, forgets deleted elements"
then: "only the other stays pinned, and one Undo pins it again"
when: "the dropped element is unpinned"
---
