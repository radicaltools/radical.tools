---
id: "92eeab3e-6800-4271-8394-3e654620e751"
type: "scenario"
label: "Workflow runs measured"
given: "the github-actions sensor's fixture: a stand-in for `gh` with workflow runs and branch rules"
then: "it measures ci.pr.duration.p90, ci.main.success.rate and ci.required-checks, with no labels, and judges no value"
when: "the sensor runs"
---
