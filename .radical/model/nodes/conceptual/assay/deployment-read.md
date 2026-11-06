---
id: "a3af5eb0-3e6d-4924-9de9-13ae776d3fef"
type: "scenario"
label: "Deployment read"
given: "a docker-compose file with a service built from a unit, a PostgreSQL image and an environment variable holding the other service's address, and a Kubernetes Deployment with such a variable"
then: "the services, the database and both addresses are facts, and the address links the caller's unit to the called one"
when: "Assay reads the repository"
---
