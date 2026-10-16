---
id: "fc6bb6fe-086f-4c34-82c2-2d33f8a1666c"
type: "requirement"
label: "Goals in percent"
action: "measure each metric (the share of requirements with a scenario, of accepted ADRs with a fitness function, and with test reports of requirements and ADRs verified, scenarios passing, tests the model names, …) and report each one below its goal as a goal-unmet finding, an error unless the config sets goal-unmet or goal-unmet/<metric> otherwise, naming every goal key that matches no metric"
ears_type: "optional"
feature: "the model's check.json sets goals for metrics"
rationale: "A baseline says how many gaps a rule may have; a goal says how much of the model must be covered, so it keeps its meaning as the model grows. The share is rounded down, so 84.9 % never shows as a met 85 %. Evidence: packages/common/src/check/goals.ts (CHECK_METRICS, measureGoals, GOAL_RULE), packages/common/src/check/files.ts (parseCheckConfig), packages/common/src/check/format.ts (Goals block), apps/cli/src/check.ts (--list-rules)"
---
