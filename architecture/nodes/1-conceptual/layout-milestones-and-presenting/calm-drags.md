---
id: "e3b7e896-022b-4fa0-b343-7440d4ba2b5e"
type: "requirement"
label: "Calm drags"
action: "Studio shall move only that element, the other selected elements dragged with it and the members of its alignments (across their line), push clear only the elements it then covers, and keep the dropped elements where they were dropped through later runs of the live physics until the user unpins them or lays the canvas out again; with Cmd/Ctrl held from the start of the drag, the live physics shall make room around it instead."
ears_type: "event-driven"
rationale: "Arranging a large diagram by hand used to move dozens of untouched elements and pull the dropped one back. Evidence: packages/ui/src/layout/liveColaEngine.ts (calm drags, clearOverlaps, PINNED); packages/common/src/c4.ts (PinConstraint); packages/ui/src/components/AlignmentGuides.tsx (unpin)"
trigger: "the user drags an element on a canvas and drops it"
---
