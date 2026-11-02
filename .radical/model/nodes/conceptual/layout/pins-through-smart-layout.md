---
id: "a37c201c-ebb6-4e35-b150-ec6acac01186"
type: "scenario"
label: "Pins through Smart Layout"
given: "a view with two elements pinned where the author dropped them, the rest piled up"
then: "over the whole view every element is arranged and the pins are taken off; round a selection the pinned elements have not moved, nor the frames holding them (moving one would carry them along), the rest stands tidied round them, and the pins are still there; a run over a view with nothing left to tidy that only unpins is one undo step, and Undo pins the elements again and moves nothing"
when: "Smart Layout runs over the whole view, or tidies around a selection"
---
