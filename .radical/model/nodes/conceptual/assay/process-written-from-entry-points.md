---
id: "482ac21d-83ed-4143-8e8a-d96008b74a22"
type: "scenario"
label: "Process written from entry points"
given: "an Assay run whose facts hold the routes of placing an order and a person and container written earlier"
then: "the process and its ordered steps are written inferred, each performed by its element, with their evidence in run.json; a step citing nothing refuses the plan"
when: "the agent applies a plan with the process Place an order and three steps citing those routes"
---
