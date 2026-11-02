---
id: "58b63448-2aa5-4e8b-b45e-1e2135f48123"
type: "requirement"
label: "Agent Smart Layout"
action: "The MCP server shall run Smart Layout the way Studio does, with Studio's budget (TIDY_BUDGET), so a view gets the layout Studio gives it, store a view's result in that view's own positions, and report the moves and the cost parts Studio's notice names (tidySummary); a view with no canvas (a flow, table or wiki view) it shall refuse, as it refuses align_nodes and grid_nodes there."
ears_type: "event-driven"
rationale: "Agents can tidy the diagram after larger changes. A flow view is played as a sequence and keeps no positions; Smart Layout there reported an improvement and wrote nothing (exploratory run 28, 2026-10-20). The MCP server tidied with no budget, for minutes, to another layout than Studio's, and reported other numbers than Studio's notice (round 185–192, 2026-10-26, F-0080, F-0082); on the sample none of 283 elements differs now. Evidence: packages/layout/src/tidy/index.ts (TIDY_BUDGET, tidySummary); apps/mcp/src/folderModel.ts (smartLayout); packages/common/src/ai/tools/layoutTools.ts (noCanvasLayout); apps/mcp/src/catalogueTools.test.ts ('lays out one view into its own positions'); manual#mcp"
trigger: "an agent calls smart_layout for All elements or one view"
---
