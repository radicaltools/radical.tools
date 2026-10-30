---
id: "89971eec-eb95-41fb-9891-69d9c5a16590"
type: "scenario"
label: "Limit against the median of earlier runs"
given: "a fitness function with studio.open_ms{model=x14} <= baseline + 20%, and nine earlier nights of it, one of them slow, two of them older than the other seven"
metrics: |
  test(packages/common/tests/checkMetrics.test.ts › conditions against a baseline › reads the baseline with a margin in percent or in a unit, and none) passed
  test(packages/common/tests/checkMetrics.test.ts › conditions against a baseline › compares the latest measurement with the median of the latest seven of the baseline, plus the margin) passed
  test(packages/common/tests/checkMetrics.test.ts › conditions against a baseline › takes a margin in a unit, and a baseline measured in another unit, in the measurement's unit) passed
  test(packages/common/tests/checkMetrics.test.ts › conditions against a baseline › says a condition is not evaluated while the baseline has nothing to compare with, and fails nothing for it) passed
  test(apps/cli/src/cli.test.ts › radical check › compares a condition against a baseline with the median of the --baseline files, keeping none of them beside the model) passed
then: "the baseline is 5,000 ms, the median of the seven latest, and the limit 6,000 ms: 5,900 passes and 6,100 fails, the finding naming the baseline and the limit; a margin in another unit converts; without earlier nights the condition is not evaluated, a warning, and fails nothing; the CLI fails with them and keeps none of them beside the model"
when: "tonight's measurement is 5,900 ms, then 6,100 ms; the margin is 0.5 s against nights measured in seconds; there are no earlier nights; and radical check is run with --baseline on a folder of them"
---
