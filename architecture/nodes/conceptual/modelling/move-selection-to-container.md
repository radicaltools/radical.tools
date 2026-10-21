---
id: "e81279dc-b55b-4e18-b449-9ed917821dbf"
type: "requirement"
label: "Move selection to container"
action: "Studio shall re-parent the selected siblings into that target, keeping their position on a canvas only where they then lie inside the target and clear of its children, otherwise placing them inside it beside its children, growing the target and moving what lies round it out of its way, on every canvas that draws them, and take each of them out of the rows, columns and grids it would share with its new ancestor, on every canvas, keeping it in an alignment with its new siblings; offering only allowed targets outside the selected subtrees; MCP move_node does the same."
ears_type: "event-driven"
rationale: "Re-parenting without redrawing keeps relations and layout intact where it can; where the old place lies on the old container or outside the new one, rule 4 (nothing overlaps, a child lies inside its parent) wins (the maintainer, 2026-10-21; exploratory runs 27 and 36). 300 random moves: 681 overlaps on the canvas shown and 59 on others before, none after. An element moved into another member of a row kept that row with its own ancestor, which no layout can satisfy; the maintainer decided on 2026-10-21 (D10, exploratory runs 45 to 64, item 166) that the move takes it out of such alignments. Evidence: packages/layout/src/geometry.ts (settleMovedNodes, growWithRoom, makeRoomAround), packages/ui/src/store/diagramStore.ts (reparentNodes, placeUnplaced), packages/common/src/model.ts (reparentNodes, alignments left on a move), packages/common/src/ai/modelFacade.ts (move_node), apps/mcp/src/folderModel.ts (settleGeometry); manual#selection"
trigger: "the user picks a target under Move to… in the selection bar"
---
