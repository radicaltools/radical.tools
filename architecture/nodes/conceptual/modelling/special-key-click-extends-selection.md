---
id: "38028fc1-8689-48aa-819e-8561038a0a4c"
type: "requirement"
label: "Special-key click extends selection"
action: "the canvas shall add the node to the current selection, or take it out where it is in it, also right after a box selection; a drag over the empty canvas shall select what its box covers, and in Viewer and Presenter so shall a drag from the empty inside of a frame (in Designer that drag draws a line from the frame)."
ears_type: "event-driven"
rationale: "Multi-selection is the entry point for bulk wrap, move, hide and delete. In Viewer and Presenter a box drawn from the empty inside of a frame selected the frame itself, not what it holds (round 185–192, 2026-10-26, F-0085). After a box selection, a click with the key on one of the selected left the selection as it was, in every perspective (F-0094, round 193–200, 2026-10-26). Evidence: packages/ui/src/components/Canvas.tsx:539-554,953; packages/ui/src/store/diagramStore.ts:2571-2610; manual#selection"
trigger: "the user clicks a node with the special key held, without dragging, or drags over the empty canvas, or from a frame, with it held"
---
