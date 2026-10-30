---
id: "22903dd6-402f-4059-99d2-f9e08f6c25b0"
type: "scenario"
label: "A spec writes its metrics"
given: "the playwright sensor's fixture, a runner that writes a radical-metrics/1 file into RADICAL_METRICS_DIR"
metrics: "test(apps/cli/src/sensors/contract.test.ts › sensor adapters › playwright: writes radical-metrics/1 from its fixture and judges no value) passed"
then: "it measures what the file holds, and judges no value"
when: "the sensor runs"
---
