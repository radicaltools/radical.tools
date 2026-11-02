---
id: "132112b1-10ed-4f77-8366-90db0dca5d11"
type: "scenario"
label: "Move leaves shared alignments"
given: "elements in a row, a column and a grid on several canvases"
then: "the moved element leaves every alignment it would share with its new parent, on every canvas, and stays in an alignment with its new siblings, which holds at once, in Studio and through move_node, so a reload moves nothing"
when: "one of them is moved into another member of the same alignment, in Studio or with move_node, and another is moved beside siblings it is aligned with"
---
