---
id: "cc714896-0081-4844-b0ee-763bf5a21e1f"
type: "requirement"
label: "Kept alignments"
action: "Studio and the MCP server shall keep the drawn centres of those elements on one horizontal (row) or vertical (column) line through drags, the live physics and Smart Layout, on that canvas only, and, when the alignment keeps its order, keep the elements along the line (left to right, top to bottom) in the order the user selected them in (for an agent, the order of nodeIds)."
ears_type: "state-driven"
precondition: "a canvas has an alignment of two or more elements"
rationale: "Some arrangements carry meaning (a tier, a flow, a reading order) that no layout score knows about; the user states it once instead of fixing it after every layout. Evidence: packages/layout/src/constraints.ts; packages/ui/src/layout/liveColaEngine.ts (projectGroupAlignments, ordered separation constraints); apps/studio/src/renderer/src/components/SelectionActionBar.tsx; packages/common/src/ai/tools/layoutTools.ts (align_nodes keepOrder); manual#layout"
---
