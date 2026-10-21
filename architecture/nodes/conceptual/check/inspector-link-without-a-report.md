---
id: "da812ac3-feac-4cf5-97b8-881edd493235"
type: "scenario"
label: "Inspector link without a report"
given: "a model with neither a check report nor a base"
tests: "apps/e2e/tests/studio/inspector.spec.ts › a link to the Inspector of a model with nothing for it opens Viewer, as its greyed-out button says"
then: "Studio opens the model in Viewer, the address names Viewer, and the Inspector button is greyed out with its tooltip saying how to make a report"
when: "the user opens a link to its Inspector"
---
