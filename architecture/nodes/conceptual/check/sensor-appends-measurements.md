---
id: "6e84a74e-ca7f-4ba7-9c51-0610162fcb47"
type: "scenario"
label: "Sensor appends measurements"
given: "a model folder and a JSON file holding a value at a known path"
metrics: "test(apps/cli/src/sense.test.ts › radical sense › appends what an adapter measured to .radical/measurements.json, judging nothing) passed"
then: "the folder's .radical/measurements.json holds the value, its unit, the label, the source and the time, and the exit status is 0 whatever the value"
when: "radical sense json reads it with a label"
---
