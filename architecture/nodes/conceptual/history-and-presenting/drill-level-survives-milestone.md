---
id: "ac8deef2-157e-49fa-941a-cb3c16a8a339"
type: "scenario"
label: "Drill level survives milestone"
given: "the sample's Platform Hierarchy view drilled down to Payments Service"
tests: "apps/e2e/tests/studio/runs-13-24.spec.ts › a milestone without the treemap's drill element leaves the view's drill level alone"
then: "the view still has its focus saved on Payments Service"
when: "the user shows milestone v1, which lacks that element, then goes back to the current model"
---
