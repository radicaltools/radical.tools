---
id: "6044dd7a-0134-485f-9ecc-bc717cc85aaa"
type: "fitness-fn"
label: "Sensor contract"
category: "structural"
metrics: |
  test(apps/cli/src/sensors/contract.test.ts) passed
  test(packages/common/tests/checkMetrics.test.ts) passed
---

apps/cli/src/sensors/contract.test.ts runs every adapter in the registry on its fixture and validates what it writes against radical-metrics/1 (version, source, time, measurements with a metric name, a finite value and a unit), and checks that no adapter takes a threshold or sets a failing exit status from a value. packages/common/tests/checkMetrics.test.ts checks the engine: conditions read, measurements matched by metric and labels, combine, max_age, units.

Threshold: Both suites pass in CI: every registered adapter writes valid radical-metrics/1 and none judges a value.
