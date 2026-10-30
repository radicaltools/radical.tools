---
id: "a4175776-cca2-404f-bb38-6fdcf7e82af3"
type: "requirement"
label: "Measure names a sensor"
action: "then radical check shall report fitness-fn-measure-invalid for it, an error naming the line and the sensors there are."
ears_type: "unwanted-behaviour"
rationale: "A measure the night cannot run would be found only the morning after. Evidence: packages/common/src/check/sensors.ts (SENSOR_NAMES), packages/common/src/check/rules.ts"
unwanted_condition: "a line of a fitness function's measure names no sensor of radical sense"
---
