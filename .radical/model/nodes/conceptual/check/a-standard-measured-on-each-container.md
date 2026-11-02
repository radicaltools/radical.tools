---
id: "7e9d975c-6540-41f5-8adb-8981bc68cf7b"
type: "scenario"
label: "A standard measured on each container"
given: "payments' model fetching the fitness function APIs described in OpenAPI and the ADR it implements from general-architecture, the ADR constraining Payments API and Refunds API but not Ledger worker, and .radical/sensors/sensors.json mapping openapi to a script"
metrics: |
  test(apps/cli/src/sense.test.ts › radical sense run › runs a sensor of radical.sensors.json once per element its decision constrains, with the context) passed
  test(apps/cli/src/sense.test.ts › radical sense run › names a sensor neither built in nor in radical.sensors.json) passed
then: "the script runs once for each constrained container, with its own arguments and --context naming the container (type, technology, parent), the ADR and the fitness function; openapi.exit_code and what it wrote to metricsOut carry the container's element label; Ledger worker is not measured; a measure line naming a sensor neither built in nor in .radical/sensors/sensors.json is reported naming the sensor and the file"
when: "radical sense run --trigger pull-request runs, with the script failing for Refunds API and writing a measurement of its own to metricsOut for Payments API"
---
