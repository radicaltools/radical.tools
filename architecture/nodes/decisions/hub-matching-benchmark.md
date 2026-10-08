---
id: "095e3765-52b0-40a1-9fb5-33a2036c66d8"
type: "fitness-fn"
label: "Hub matching benchmark"
category: "structural"
threshold: "Tuning briefs: precision >= 0.45, recall >= 0.52, all expected concepts among the candidates, no wrong blueprint; holdout: precision >= 0.35, recall >= 0.40, all among the candidates, no wrong blueprint"
---

packages/hub-catalogue/tests/hubMatching.test.ts scores the ranking on the briefs in hubMatchingBriefs.ts: the suggestions shown without AI (precision, recall), the candidates the model picks from (recall in the first 12 and overall) and the blueprint. Floors sit just under the measured values; tune on BRIEFS only, never on HOLDOUT_BRIEFS. hubMatchingModel.test.ts scores the model's pick when HUB_BENCH_ANTHROPIC_KEY is set.
