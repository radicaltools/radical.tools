---
id: "405281c4-5a2c-43e0-9d80-93644d3f5573"
type: "requirement"
label: "Same layout every run"
action: "Smart Layout shall produce the same positions for the same diagram on every run, seeding its annealing from the graph structure and sizing its budgets in units of work rather than time."
ears_type: "ubiquitous"
rationale: "A repeatable result keeps saved models stable in version control and makes layout changes reviewable. Tidy's budget is counted in work too (moves judged, each weighted by the view's elements), not milliseconds, so a slow machine gets the layout a fast one does (round 185–192, 2026-10-26, F-0080). Labels are measured for a layout by the UI font's advance table (tableMeasure), never by the canvas: measured in the font the platform has, Tidy's worker in Studio and the MCP server gave one view two layouts (round 193–200, 2026-10-26); only the canvas's label placement measures the drawn font. Evidence: packages/layout/src/tidy/index.ts (TIDY_BUDGET, TidyOptions.budget); packages/layout/tests/tidy/craft.test.ts (a budget is counted in work); packages/layout/src/annealing.ts:48-69; packages/layout/src/smartLayout.ts:779-802, packages/layout/src/smartLayout.ts:1242; packages/layout/tests/smartLayout.test.ts:183-187; packages/layout/tests/annealing.test.ts:110-125; apps/e2e/tests/studio/layout.spec.ts:58-72; packages/layout/src/edgeLabels.ts (tableMeasure), packages/layout/src/tidy/cost.ts, packages/layout/src/labelRoom.ts"
---
