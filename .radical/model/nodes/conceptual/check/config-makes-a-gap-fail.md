---
id: "c424de75-788f-4f02-9510-19e1f747eb20"
type: "scenario"
label: "Config makes a gap fail"
given: "that model and a check.json in the model folder setting requirement-without-scenario to error"
metrics: "test(apps/cli/src/cli.test.ts › radical check › exits 1 when the config makes a finding an error, read from the model's check.json) passed"
then: "the output ends with 1 error and the exit status is 1"
when: "the user runs `radical check model`"
---
