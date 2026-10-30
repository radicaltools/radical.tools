---
id: "bf6fefab-84b5-42d6-b80c-035097128389"
type: "fitness-fn"
label: "Smart Layout quality"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
metrics: "test(packages/layout/tests/smartLayoutScoring.test.mjs) passed"
scope: "holistic"
trigger: "pull-request"
---

Checked by hand around layout changes, not in CI. The score is computeCompositeScore in packages/layout/src/smartLayout.ts (rendered crossings, overdraws, stub loops, overlap, edge lengths, leaf centrality, aspect ratio, compactness, symmetry and label crowding, weighted in scoreWeights.ts); computeLayoutMetrics in packages/layout/src/crossingOpt.ts gives the straight-line crossings and overdraws. packages/layout/tests/saThroughput.bench.mjs runs runSmartLayoutCore five times on a 20-element fintech-like diagram and prints wall time, annealing iterations and iterations per second, composite and rendered crossings. packages/layout/tests/visual/layoutHarness.mjs lays out four scenarios (screenshot, chain, hub, microservices), prints their score terms and writes tests/visual/out-<name>.svg. Both run with node --import tsx from packages/layout (tsx is not a dependency of @radical/layout; it resolves from other workspaces). Results are deterministic for a given diagram: the annealing is seeded from the graph structure (graphSeed) and its budgets are counted in work, and the wall-clock deadlines (3 s, 1.5 s, 1.5 s) only cut pathological inputs; repeated runs give the same composite, so compare several fixtures at several seeds (runSmartLayoutCore options.seed, at least five) instead of repeated runs. packages/layout/tests/smartLayoutScoring.test.mjs, part of npm test, checks that the score ranks a hand-fixed layout better than the algorithm's.

Threshold: No drop in the composite score, averaged over the fixtures at five or more seeds, against main. Pure refactors keep runSmartLayoutCore's output identical over the fixture set (the fintech sample plus the Hub blueprints and patterns), proved by hashing the full result; that hashing script is not in the repo.
