---
id: "792bc652-c52b-4ad9-bed4-57be1e9f4a28"
type: "scenario"
label: "Plan written to the central model"
given: "an Assay run and a plan of a system, its containers from units and a relation from a link"
then: "the central model has them, .radical/assay/run.json holds each one's evidence and confidence, and no element's properties hold either"
when: "the agent applies it"
---
