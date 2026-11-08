---
id: "3694a89e-1135-483e-9386-a2a00daa9943"
type: "scenario"
label: "Names within their own repository"
given: "two repositories of one run, each with a compose file whose services depend on a rabbitmq service of their own, and a unit in each naming host rabbitmq"
then: "each repository's units depend on and call their own rabbitmq, never the other's"
when: "Assay links them"
---
