---
id: "3e840f74-df4d-4117-8394-3b41823fd768"
type: "requirement"
label: "Conditions against a baseline"
action: "it shall compare the latest measurement with the median of the latest seven baseline measurements of the same metric and labels, plus or minus the condition's margin, in the measurement's unit, and report the condition not evaluated, with no baseline to compare with, when the baseline holds none of them."
ears_type: "event-driven"
rationale: "A fixed limit lets a slowdown through that stays under it, and a measurement on CI's shared machines varies by 10 to 20 % from run to run: one run as the baseline gives false findings. The user chose the median of the last seven nights (2026-10-30); the absolute limit stays beside it, for a slow drift the median follows. Evidence: packages/common/src/check/metrics.ts (parseCondition, baselineOf, evaluateMetric), packages/common/src/check/evidence.ts, apps/cli/src/check.ts (--baseline), tools/nightly-findings.ts"
trigger: "radical check evaluates a metric condition stated against a baseline (`studio.open_ms{model=radical-x14} <= baseline + 20%`, or `+ 500 ms`), with baseline measurements given by --baseline"
---
