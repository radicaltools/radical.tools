---
id: "39163ca3-ee1f-46f9-ab5e-c1a2c302ba23"
type: "requirement"
label: "Blocks when zoomed out"
action: "Studio shall draw each element as a block of its type's colour with its name as large as the block holds, and a container with children as a dashed frame with its name, at the element's size and place, with two handles instead of eight and the button that opens or folds a container, drawn above the relations; draw the full cards again once zoomed in; take the level for a view from the camera it opens with; and draw cards in an exported picture."
ears_type: "state-driven"
precondition: "the canvas is zoomed out below 0.3 (entering below 0.27, leaving above 0.33)"
rationale: "A card's text is a fraction of a pixel at the zoom a large model fits at, and the browser spent most of opening one on building and measuring full cards: the whole architecture/ model (888 elements) opened in 0.38 s, with blocks in about 0.25 s. Sizes stay, so layouts do not move. Evidence: packages/ui/src/store/canvasDetail.ts, packages/ui/src/components/nodes/C4Nodes.tsx (SimpleNode, withDetail), packages/ui/src/components/Canvas.tsx, packages/ui/src/store/diagramStore.ts (lowDetail, setActiveView), apps/e2e/tests/studio/bench.spec.ts"
---
