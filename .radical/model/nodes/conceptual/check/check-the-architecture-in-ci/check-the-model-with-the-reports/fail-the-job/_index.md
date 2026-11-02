---
id: "658dae0b-718f-4088-bd89-d58564d709fc"
type: "step"
label: "Fail the job"
children: "sequence"
condition: "if a finding is an error"
order: 2
repeat: "1"
---

A failing or missing named test, a gap above its baseline, a metric below its goal; annotations on the pull request.
