---
id: "68a574e8-280f-4917-a170-9ed3b78c436e"
type: "requirement"
label: "Laid-out diagram stands"
action: "The live layout shall leave every element where it is; an element added stays where it is dropped, and what it covers, or what the container it grew covers, is pushed just clear; elements shown by an expand settle with their nearest surroundings; and every run of the physics shall stop at the latest 8 seconds after it starts (4 with a row or column of containers), the diagram standing as it is then; and a canvas shall measure a container with nothing in it at the folded size it draws it, and take nothing inside a container the view does not draw for astray, so that a view opened again shows what was saved."
ears_type: "state-driven"
precondition: "a canvas shows a diagram whose elements have positions (opened from a file, switched to, restored by undo, or just arranged by Smart Layout)"
rationale: "What Smart Layout chose and reported must be what is saved and shown; a model opened again must not change. An add once freed the 40 nearest elements and moved 43 unrelated ones on the sample (item 256); a run on the sample was still drifting after 40 s (item 265). A state machine grown on one view was placed afresh and rearranged each time another view was opened, since an empty container was measured at its default size and the children of an undrawn container were taken for astray (run 182, 2026-10-23, F-0049). Evidence: packages/layout/src/liveColaEngine.ts (rebuild 'rest' and 'local', settled, clearOverlaps); packages/layout/src/geometry.ts (placeUnplaced); packages/layout/tests/liveColaRest.test.ts; packages/ui/tests/physicsStands.test.ts; manual#layout"
---
