---
id: "5dca88c1-d0f4-400d-85bc-c2cca4402f0b"
type: "adr"
label: "User alignments bind layout"
alternatives: "Snap after Smart Layout only (candidates ranked without the rule, so the winner may be a poor fit once snapped); hold alignments only in the live physics (large diagrams, the MCP server and presentations have no physics); constrain only siblings (simpler, but rows across containers are a common ask)."
consequences: "Smart Layout's output for a canvas without constraints stays identical. Alignments centre on the size the canvas draws (drawnSize), not the stored size the engines place. New constraint kinds (spacing, fixed position) extend the same type and both solvers."
context: "Users want some elements to stay in a row or a column on a canvas whatever moves. \"Graph views use Smart Layout\" says Smart Layout's positions are not post-processed, and the live WebCoLa physics, Smart Layout and the MCP server each place nodes."
date: "2026-10-07"
decision: "A canvas (a view, or All elements) keeps layout constraints (LayoutConstraint, so far only 'align': equal centre x or y, optionally keeping the members' order along the line). Every engine honours them: WebCoLa holds an alignment of leaves with its own alignment constraint and an order with separation constraints, and one with an expanded container by a projection after each tick; Smart Layout applies enforceAlignments (@radical/layout constraints.ts) inside its finalisation, so every candidate is ranked and refined with the alignment applied; the store and the MCP server apply the same pass after their parent refit. This is the one post-processing of Smart Layout's positions allowed, and it changes nothing when a canvas has no constraints."
status: "accepted"
---
