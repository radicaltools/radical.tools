---
id: "7b5e2584-3d78-4530-aac8-734cabe989b8"
type: "scenario"
label: "Measurements fetched from CI"
given: "a CI run whose artifacts hold a test report and a radical-metrics/1 file, and measurements kept beside the model, one of the same metric measured earlier"
then: ".state/measurements.json holds the measurements of the run, the later one of the same metric and labels in place of the earlier, each with the run and commit in its context, and the conditions on them are evaluated; the Measurements chip says how many come from CI and from which run"
when: "radical check runs with --from-ci"
---
