---
id: "50d44dce-eda0-4d3a-bd9d-cbd42d22366a"
type: "scenario"
label: "The night runs the model's measures"
given: "a model with an automated fitness function triggered on nightly with two measure lines, one triggered on pull-request, and a manual one triggered on nightly"
metrics: "test(apps/cli/src/sense.test.ts › radical sense › runs the measure of every automated fitness function triggered on the event, and says what it could not measure) passed"
then: "only the two lines of the nightly automated one run, each writes its file into the directory, and a line whose sensor fails is named with why"
when: "radical sense run --trigger nightly runs"
---
