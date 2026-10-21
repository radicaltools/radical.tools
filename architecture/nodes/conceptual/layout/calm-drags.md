---
id: "e3b7e896-022b-4fa0-b343-7440d4ba2b5e"
type: "requirement"
label: "Calm drags"
action: "Studio shall move only that element, the other selected elements dragged with it and the members of its alignments (across their line), push clear only the elements it then covers, past their far edge (also when a container grew right over a neighbour), move an element pushed onto the dropped one off it again, and put what is still covered when the pushes run out below the rest of its level (to the right when a line holds it vertically), so that a drop leaves nothing overlapping; leave the groups beside a group it is dropped into below their system's header, and keep the dropped elements where they were dropped through later runs of the live physics until the user unpins them or lays the canvas out again; with Cmd/Ctrl held from the start of the drag on a canvas of fewer than 150 elements, the live physics shall make room around it instead, starting only once the element is dragged, so a Cmd/Ctrl-click without a drag moves nothing."
ears_type: "event-driven"
rationale: "Arranging a large diagram by hand used to move dozens of untouched elements and pull the dropped one back. A calm drop could still leave elements overlapping: a child dragged far out of its container past the one below, or more covered elements than the pushes allowed (exploratory runs 65 to 69, 2026-10-21; open item 3 of \"Calm drags and pins\"). Evidence: packages/ui/src/layout/liveColaEngine.ts (calm drags, clearOverlaps, clearing, clearLeftovers, CALM_MAX_PUSHES, PINNED); packages/common/src/c4.ts (PinConstraint); packages/ui/src/components/AlignmentGuides.tsx (unpin)"
trigger: "the user drags an element on a canvas and drops it"
---
