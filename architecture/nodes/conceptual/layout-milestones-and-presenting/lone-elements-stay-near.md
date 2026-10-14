---
id: "3ed3986b-5dbf-4d15-a063-ec63b2d38239"
type: "requirement"
label: "Lone elements stay near"
action: "The live layout shall draw that element towards those containers through free room until it is about 240 px from them, without pushing other elements, and leave it where it is while it is dragged, pinned or aligned."
ears_type: "state-driven"
precondition: "the live layout is running and an element at the top level of the canvas has relations only to expanded containers, none to another element"
rationale: "WebCoLa links only leaves, so a relation that ends on an open container gives no force, and such an element stayed behind when the rest moved and ended far from the diagram. Elements inside a container are held by the container instead. Evidence: packages/layout/src/liveColaEngine.ts (holdByGroups, GROUP_HOLD_GAP), packages/layout/tests/groupHoldPhysics.test.ts"
---
