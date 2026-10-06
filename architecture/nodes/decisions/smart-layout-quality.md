---
id: "bf6fefab-84b5-42d6-b80c-035097128389"
type: "fitness-fn"
label: "Smart Layout quality"
category: "holistic"
threshold: "No drop in the composite layout score. Pure refactors keep runSmartLayoutCore's output identical over the fixture set (the fintech sample plus the Hub blueprints and patterns), proved by hashing the full result; the hashing script is not in the repo yet."
---

Measured with computeLayoutMetrics (packages/layout/src/smartLayout.ts), packages/layout/tests/saThroughput.bench.mjs and packages/layout/tests/visual/layoutHarness.mjs over several fixtures and runs (results are not deterministic).
