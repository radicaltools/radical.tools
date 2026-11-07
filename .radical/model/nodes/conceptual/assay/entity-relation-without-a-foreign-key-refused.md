---
id: "e8d3e5f9-80fd-4e36-ace1-8cd33b678de7"
type: "scenario"
label: "Entity relation without a foreign key refused"
given: "the same run"
then: "the plan is refused with the reason and nothing is written"
when: "the agent applies a plan relating customers to orders, which no foreign key joins, or an entity citing no table"
---
